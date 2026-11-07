package com.scoopi.creepertackle.client;

import com.scoopi.creepertackle.network.TacklePayload;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public class CreeperTackleClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ClientPlayNetworking.registerGlobalReceiver(TacklePayload.ID,
                (payload, context) -> TackleAnimations.start(context.client(), payload));
        ClientTickEvents.END_CLIENT_TICK.register(TackleAnimations::tick);
    }
}
