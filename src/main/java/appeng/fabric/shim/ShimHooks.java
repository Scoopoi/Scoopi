package appeng.fabric.shim;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.material.Fluid;

/**
 * Replacements for methods that NeoForge patches into vanilla classes.
 */
public final class ShimHooks {
    private static final Map<Item, Object> DEFAULT_ITEM_RESOURCES = new ConcurrentHashMap<>();
    private static final Map<Fluid, Object> DEFAULT_FLUID_RESOURCES = new ConcurrentHashMap<>();

    private ShimHooks() {
    }

    @SuppressWarnings("unchecked")
    public static <T> T defaultItemResource(Item item, Function<Item, T> factory) {
        return (T) DEFAULT_ITEM_RESOURCES.computeIfAbsent(item, factory::apply);
    }

    @SuppressWarnings("unchecked")
    public static <T> T defaultFluidResource(Fluid fluid, Function<Fluid, T> factory) {
        return (T) DEFAULT_FLUID_RESOURCES.computeIfAbsent(fluid, factory::apply);
    }

    public static Set<Block> getValidBlocks(BlockEntityType<?> type) {
        return type.validBlocks;
    }

    public static net.minecraft.core.HolderSet<Item> ingredientValues(net.minecraft.world.item.crafting.Ingredient ingredient) {
        return ingredient.values;
    }

    public static net.minecraft.core.NonNullList<net.minecraft.world.item.ItemStack> nonNullListOf(
            java.util.List<net.minecraft.world.item.ItemStack> list) {
        var result = net.minecraft.core.NonNullList.withSize(list.size(), net.minecraft.world.item.ItemStack.EMPTY);
        for (int i = 0; i < list.size(); i++) {
            result.set(i, list.get(i));
        }
        return result;
    }
}
