package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

import net.minecraft.world.item.crafting.RecipeManager;
import net.minecraft.world.item.crafting.RecipeMap;
import net.neoforged.neoforge.common.extensions.IRecipeManagerExtension;

@Mixin(RecipeManager.class)
public interface RecipeManagerAccessor extends IRecipeManagerExtension {
    @Accessor("recipes")
    RecipeMap ae2_getRecipes();
}
