package net.neoforged.neoforge.client.event;

import java.util.Set;

import net.minecraft.world.item.crafting.RecipeMap;
import net.minecraft.world.item.crafting.RecipeType;
import net.neoforged.bus.api.Event;

public class RecipesReceivedEvent extends Event {
    private final Set<RecipeType<?>> recipeTypes;
    private final RecipeMap recipeMap;

    public RecipesReceivedEvent(Set<RecipeType<?>> recipeTypes, RecipeMap recipeMap) {
        this.recipeTypes = recipeTypes;
        this.recipeMap = recipeMap;
    }

    public Set<RecipeType<?>> getRecipeTypes() {
        return recipeTypes;
    }

    public RecipeMap getRecipeMap() {
        return recipeMap;
    }
}
