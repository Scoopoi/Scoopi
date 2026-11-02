package net.neoforged.neoforge.common.extensions;

import org.jspecify.annotations.Nullable;

import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.level.block.entity.FuelValues;
import net.neoforged.neoforge.capabilities.ItemCapability;

/** Injected into {@link ItemStack}. */
public interface IItemStackExtension {
    private ItemStack self() {
        return (ItemStack) this;
    }

    @Nullable
    default <T, C> T getCapability(ItemCapability<T, C> capability, C context) {
        return capability.getCapability(self(), context);
    }

    @Nullable
    default <T> T getCapability(ItemCapability<T, @Nullable Void> capability) {
        return capability.getCapability(self(), null);
    }

    default boolean isComponentsPatchEmpty() {
        return self().getComponentsPatch().isEmpty();
    }

    default int getBurnTime(@Nullable RecipeType<?> recipeType, FuelValues fuelValues) {
        return self().getItem().getBurnTime(self(), recipeType, fuelValues);
    }
}
