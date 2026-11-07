package com.scoopi.stormbow;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.creativetab.v1.CreativeModeTabEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.core.Registry;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.Rarity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Stormcaller implements ModInitializer {
    public static final String MOD_ID = "stormcaller";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    /** Entity tag put on arrows fired from the Stormcaller Bow. */
    public static final String ARROW_TAG = "stormcaller_arrow";

    public static final ResourceKey<Item> BOW_KEY =
            ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "stormcaller_bow"));

    public static final Item STORMCALLER_BOW = Registry.register(BuiltInRegistries.ITEM, BOW_KEY,
            new StormcallerBowItem(new Item.Properties()
                    .setId(BOW_KEY)
                    .durability(384)
                    .rarity(Rarity.EPIC)
                    .component(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true)));

    private static final ResourceKey<CreativeModeTab> COMBAT_TAB =
            ResourceKey.create(Registries.CREATIVE_MODE_TAB, Identifier.withDefaultNamespace("combat"));

    @Override
    public void onInitialize() {
        CreativeModeTabEvents.modifyOutputEvent(COMBAT_TAB)
                .register(output -> output.insertAfter(Items.BOW, STORMCALLER_BOW));
        ServerTickEvents.END_SERVER_TICK.register(server -> SmiteManager.tick());
        LOGGER.info("Stormcaller Bow loaded - the skies are listening.");
    }
}
