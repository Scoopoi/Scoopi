package net.neoforged.neoforge.common.extensions;

import net.minecraft.world.item.crafting.RecipeManager;
import net.minecraft.world.item.crafting.RecipeMap;

/** Injected into {@link RecipeManager}. */
public interface IRecipeManagerExtension {
    default RecipeMap recipeMap() {
        return ((appeng.mixins.shim.RecipeManagerAccessor) this).ae2_getRecipes();
    }
}
