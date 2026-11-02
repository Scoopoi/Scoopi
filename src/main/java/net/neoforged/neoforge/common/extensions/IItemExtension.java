package net.neoforged.neoforge.common.extensions;

import org.jspecify.annotations.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.entity.FuelValues;

/** Injected into {@link net.minecraft.world.item.Item}. */
public interface IItemExtension {
    /** Called before the block is activated when a player uses this item on a block. */
    default InteractionResult onItemUseFirst(ItemStack stack, UseOnContext context) {
        return InteractionResult.PASS;
    }

    default boolean shouldCauseReequipAnimation(ItemStack oldStack, ItemStack newStack, boolean slotChanged) {
        return oldStack != newStack;
    }

    /** If true, sneaking players using this item will still activate the block they click on. */
    default boolean doesSneakBypassUse(ItemStack stack, LevelReader level, BlockPos pos, Player player) {
        return false;
    }

    default int getBurnTime(ItemStack itemStack, @Nullable RecipeType<?> recipeType, FuelValues fuelValues) {
        return fuelValues.burnDuration(itemStack);
    }
}
