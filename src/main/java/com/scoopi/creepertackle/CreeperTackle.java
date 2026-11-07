package com.scoopi.creepertackle;

import com.scoopi.creepertackle.network.TacklePayload;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CreeperTackle implements ModInitializer {
    public static final String MOD_ID = "creepertackle";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        PayloadTypeRegistry.playS2C().register(TacklePayload.ID, TacklePayload.CODEC);
        UseEntityCallback.EVENT.register(TackleHandler::onUseEntity);
        LOGGER.info("Creeper Tackle loaded - sprint + right-click a creeper to tackle it!");
    }
}
