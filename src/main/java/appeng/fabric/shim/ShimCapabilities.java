package appeng.fabric.shim;

import java.util.List;

import org.jspecify.annotations.Nullable;

import net.fabricmc.fabric.api.transfer.v1.context.ContainerItemContext;
import net.fabricmc.fabric.api.transfer.v1.fluid.FluidStorage;
import net.fabricmc.fabric.api.transfer.v1.fluid.FluidVariant;
import net.fabricmc.fabric.api.transfer.v1.item.ItemStorage;
import net.fabricmc.fabric.api.transfer.v1.item.ItemVariant;
import net.fabricmc.fabric.api.transfer.v1.storage.Storage;
import net.fabricmc.fabric.api.transfer.v1.storage.base.SingleSlotStorage;
import net.fabricmc.fabric.api.transfer.v1.transaction.TransactionContext;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.capabilities.BlockCapability;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.capabilities.ItemCapability;
import net.neoforged.neoforge.transfer.ResourceHandler;
import net.neoforged.neoforge.transfer.access.ItemAccess;
import net.neoforged.neoforge.transfer.fluid.FluidResource;
import net.neoforged.neoforge.transfer.item.ItemResource;

import appeng.core.AppEng;

/**
 * Glue between the NeoForge-style capability system used by AE2 and the Fabric API lookup / Transfer API.
 */
public final class ShimCapabilities {
    public static boolean initFinished;

    /** Re-entrancy guard to prevent Neo -> Fabric -> Neo lookup loops. */
    private static final ThreadLocal<Boolean> IN_FALLBACK = ThreadLocal.withInitial(() -> false);

    private ShimCapabilities() {
    }

    @SuppressWarnings("unchecked")
    @Nullable
    public static <T, C> T fallbackBlock(BlockCapability<T, C> cap, Level level, BlockPos pos, BlockState state,
            @Nullable BlockEntity blockEntity, C context) {
        if (IN_FALLBACK.get()) {
            return null;
        }
        IN_FALLBACK.set(true);
        try {
            var side = context instanceof Direction d ? d : null;
            if (cap == (Object) Capabilities.Item.BLOCK) {
                var storage = ItemStorage.SIDED.find(level, pos, state, blockEntity, side);
                if (storage != null) {
                    if (storage instanceof ResourceHandlerStorage<?, ?> rhs) {
                        return (T) rhs.handler;
                    }
                    return (T) new FabricStorageResourceHandler<>(storage, ResourceConversion.ITEMS);
                }
            } else if (cap == (Object) Capabilities.Fluid.BLOCK) {
                var storage = FluidStorage.SIDED.find(level, pos, state, blockEntity, side);
                if (storage != null) {
                    if (storage instanceof ResourceHandlerStorage<?, ?> rhs) {
                        return (T) rhs.handler;
                    }
                    return (T) new FabricStorageResourceHandler<>(storage, ResourceConversion.FLUIDS);
                }
            }
            return null;
        } finally {
            IN_FALLBACK.set(false);
        }
    }

    @SuppressWarnings("unchecked")
    @Nullable
    public static <T, C> T fallbackItem(ItemCapability<T, C> cap, ItemStack stack, C context) {
        if (IN_FALLBACK.get() || !(context instanceof ItemAccess access)) {
            return null;
        }
        IN_FALLBACK.set(true);
        try {
            if (cap == (Object) Capabilities.Fluid.ITEM) {
                var storage = FluidStorage.ITEM.find(stack, new ItemAccessContext(access));
                if (storage != null) {
                    return (T) new FabricStorageResourceHandler<>(storage, ResourceConversion.FLUIDS);
                }
            } else if (cap == (Object) Capabilities.Item.ITEM) {
                var storage = ItemStorage.ITEM.find(stack, new ItemAccessContext(access));
                if (storage != null) {
                    return (T) new FabricStorageResourceHandler<>(storage, ResourceConversion.ITEMS);
                }
            }
            return null;
        } finally {
            IN_FALLBACK.set(false);
        }
    }

    /**
     * After AE2 registered its NeoForge-style capability providers, expose them to the Fabric Transfer API as well.
     */
    public static void exposeToFabric() {
        initFinished = true;

        var itemBlocks = blocksOf(Capabilities.Item.BLOCK);
        if (itemBlocks.length > 0) {
            ItemStorage.SIDED.registerForBlocks((level, pos, state, be, side) -> {
                ResourceHandler<ItemResource> handler = neoBlockLookup(Capabilities.Item.BLOCK, level, pos, state,
                        be, side);
                return handler == null ? null : wrapItems(handler);
            }, itemBlocks);
        }
        var fluidBlocks = blocksOf(Capabilities.Fluid.BLOCK);
        if (fluidBlocks.length > 0) {
            FluidStorage.SIDED.registerForBlocks((level, pos, state, be, side) -> {
                ResourceHandler<FluidResource> handler = neoBlockLookup(Capabilities.Fluid.BLOCK, level, pos, state,
                        be, side);
                return handler == null ? null : wrapFluids(handler);
            }, fluidBlocks);
        }
        var fluidItems = itemsOf(Capabilities.Fluid.ITEM);
        if (fluidItems.length > 0) {
            FluidStorage.ITEM.registerForItems((stack, ctx) -> {
                if (IN_FALLBACK.get()) {
                    return null;
                }
                IN_FALLBACK.set(true);
                try {
                    var handler = Capabilities.Fluid.ITEM.getCapability(stack, new ContextItemAccess(ctx));
                    return handler == null ? null : wrapFluids(handler);
                } finally {
                    IN_FALLBACK.set(false);
                }
            }, fluidItems);
        }
    }

    @Nullable
    private static <T> T neoBlockLookup(BlockCapability<T, @Nullable Direction> cap, Level level, BlockPos pos,
            BlockState state, @Nullable BlockEntity be, @Nullable Direction side) {
        if (IN_FALLBACK.get()) {
            return null;
        }
        IN_FALLBACK.set(true);
        try {
            return cap.getCapability(level, pos, state, be, side);
        } finally {
            IN_FALLBACK.set(false);
        }
    }

    private static Storage<ItemVariant> wrapItems(ResourceHandler<ItemResource> handler) {
        if (handler instanceof FabricStorageResourceHandler<?, ?> fsr) {
            @SuppressWarnings("unchecked")
            var s = (Storage<ItemVariant>) fsr.storage;
            return s;
        }
        return new ResourceHandlerStorage<>(handler, ResourceConversion.ITEMS);
    }

    private static Storage<FluidVariant> wrapFluids(ResourceHandler<FluidResource> handler) {
        if (handler instanceof FabricStorageResourceHandler<?, ?> fsr) {
            @SuppressWarnings("unchecked")
            var s = (Storage<FluidVariant>) fsr.storage;
            return s;
        }
        return new ResourceHandlerStorage<>(handler, ResourceConversion.FLUIDS);
    }

    private static Block[] blocksOf(BlockCapability<?, ?> cap) {
        return cap.getRegisteredBlocks().stream()
                .filter(b -> BuiltInRegistries.BLOCK.getKey(b).getNamespace().equals(AppEng.MOD_ID))
                .toArray(Block[]::new);
    }

    private static Item[] itemsOf(ItemCapability<?, ?> cap) {
        return cap.getRegisteredItems().stream()
                .filter(i -> BuiltInRegistries.ITEM.getKey(i).getNamespace().equals(AppEng.MOD_ID))
                .toArray(Item[]::new);
    }

    /**
     * Presents an AE2 {@link ItemAccess} to Fabric as a {@link ContainerItemContext}.
     */
    private record ItemAccessContext(ItemAccess access) implements ContainerItemContext {
        @Override
        public SingleSlotStorage<ItemVariant> getMainSlot() {
            return new SingleSlotStorage<>() {
                @Override
                public long insert(ItemVariant resource, long maxAmount, TransactionContext transaction) {
                    var neoTx = TransactionBridge.toNeo(transaction);
                    return access.insert(ResourceConversion.ITEMS.toResource(resource),
                            (int) Math.min(Integer.MAX_VALUE, maxAmount), neoTx);
                }

                @Override
                public long extract(ItemVariant resource, long maxAmount, TransactionContext transaction) {
                    var neoTx = TransactionBridge.toNeo(transaction);
                    return access.extract(ResourceConversion.ITEMS.toResource(resource),
                            (int) Math.min(Integer.MAX_VALUE, maxAmount), neoTx);
                }

                @Override
                public boolean isResourceBlank() {
                    return access.getResource().isEmpty() || access.getAmount() <= 0;
                }

                @Override
                public ItemVariant getResource() {
                    return ResourceConversion.ITEMS.toVariant(access.getResource());
                }

                @Override
                public long getAmount() {
                    return access.getAmount();
                }

                @Override
                public long getCapacity() {
                    return access.getResource().isEmpty() ? 64 : access.getResource().getMaxStackSize();
                }
            };
        }

        @Override
        public long insertOverflow(ItemVariant itemVariant, long maxAmount, TransactionContext transactionContext) {
            var neoTx = TransactionBridge.toNeo(transactionContext);
            return access.insert(ResourceConversion.ITEMS.toResource(itemVariant),
                    (int) Math.min(Integer.MAX_VALUE, maxAmount), neoTx);
        }

        @Override
        public List<SingleSlotStorage<ItemVariant>> getAdditionalSlots() {
            return List.of();
        }
    }

    /**
     * Presents a Fabric {@link ContainerItemContext} to AE2 as an {@link ItemAccess}.
     */
    private record ContextItemAccess(ContainerItemContext ctx) implements ItemAccess {
        @Override
        public ItemResource getResource() {
            var slot = ctx.getMainSlot();
            return slot.isResourceBlank() ? ItemResource.EMPTY : ResourceConversion.ITEMS.toResource(slot.getResource());
        }

        @Override
        public int getAmount() {
            return (int) Math.min(Integer.MAX_VALUE, ctx.getMainSlot().getAmount());
        }

        @Override
        public int insert(ItemResource resource, int amount, net.neoforged.neoforge.transfer.transaction.TransactionContext transaction) {
            var fabricTx = TransactionBridge.toFabric(transaction);
            var variant = ResourceConversion.ITEMS.toVariant(resource);
            long inserted = ctx.getMainSlot().insert(variant, amount, fabricTx);
            if (inserted < amount) {
                inserted += ctx.insertOverflow(variant, amount - inserted, fabricTx);
            }
            return (int) inserted;
        }

        @Override
        public int extract(ItemResource resource, int amount, net.neoforged.neoforge.transfer.transaction.TransactionContext transaction) {
            var fabricTx = TransactionBridge.toFabric(transaction);
            return (int) ctx.getMainSlot().extract(ResourceConversion.ITEMS.toVariant(resource), amount, fabricTx);
        }
    }
}
