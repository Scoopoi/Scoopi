package appeng.fabric.shim;

import net.fabricmc.fabric.api.transfer.v1.fluid.FluidConstants;
import net.fabricmc.fabric.api.transfer.v1.fluid.FluidVariant;
import net.fabricmc.fabric.api.transfer.v1.item.ItemVariant;
import net.neoforged.neoforge.transfer.fluid.FluidResource;
import net.neoforged.neoforge.transfer.item.ItemResource;
import net.neoforged.neoforge.transfer.resource.Resource;

/**
 * Converts between NeoForge-style resources (as used by AE2) and Fabric Transfer API variants.
 * Fluid amounts are in millibuckets on the NeoForge side and in droplets (81000 per bucket) on the Fabric side.
 */
public interface ResourceConversion<R extends Resource, V> {
    V toVariant(R resource);

    R toResource(V variant);

    boolean isBlank(V variant);

    R emptyResource();

    /** Converts a NeoForge-side amount to a Fabric-side amount. */
    long toFabricAmount(long amount);

    /** Converts a Fabric-side amount to a NeoForge-side amount (rounding down). */
    long toNeoAmount(long amount);

    ResourceConversion<ItemResource, ItemVariant> ITEMS = new ResourceConversion<>() {
        @Override
        public ItemVariant toVariant(ItemResource resource) {
            return resource.isEmpty() ? ItemVariant.blank()
                    : ItemVariant.of(resource.getItem(), resource.getComponentsPatch());
        }

        @Override
        public ItemResource toResource(ItemVariant variant) {
            return variant.isBlank() ? ItemResource.EMPTY
                    : ItemResource.of(variant.getObject(), variant.getComponentsPatch());
        }

        @Override
        public boolean isBlank(ItemVariant variant) {
            return variant.isBlank();
        }

        @Override
        public ItemResource emptyResource() {
            return ItemResource.EMPTY;
        }

        @Override
        public long toFabricAmount(long amount) {
            return amount;
        }

        @Override
        public long toNeoAmount(long amount) {
            return amount;
        }
    };

    long DROPLETS_PER_MB = FluidConstants.BUCKET / 1000;

    ResourceConversion<FluidResource, FluidVariant> FLUIDS = new ResourceConversion<>() {
        @Override
        public FluidVariant toVariant(FluidResource resource) {
            return resource.isEmpty() ? FluidVariant.blank()
                    : FluidVariant.of(resource.getFluid(), resource.getComponentsPatch());
        }

        @Override
        public FluidResource toResource(FluidVariant variant) {
            return variant.isBlank() ? FluidResource.EMPTY
                    : FluidResource.of(variant.getObject(), variant.getComponentsPatch());
        }

        @Override
        public boolean isBlank(FluidVariant variant) {
            return variant.isBlank();
        }

        @Override
        public FluidResource emptyResource() {
            return FluidResource.EMPTY;
        }

        @Override
        public long toFabricAmount(long amount) {
            return amount > Long.MAX_VALUE / DROPLETS_PER_MB ? Long.MAX_VALUE : amount * DROPLETS_PER_MB;
        }

        @Override
        public long toNeoAmount(long amount) {
            return amount / DROPLETS_PER_MB;
        }
    };
}
