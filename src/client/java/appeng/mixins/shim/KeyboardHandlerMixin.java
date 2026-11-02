package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import net.minecraft.client.KeyboardHandler;
import net.minecraft.client.input.KeyEvent;

import appeng.fabric.AE2FabricClient;

/** Fires the NeoForge-style {@code InputEvent.Key} for every key press. */
@Mixin(KeyboardHandler.class)
public abstract class KeyboardHandlerMixin {
    @Inject(method = "keyPress", at = @At("TAIL"))
    private void ae2_onKeyPress(long window, int action, KeyEvent event, CallbackInfo ci) {
        AE2FabricClient.onKey(event.key(), event.scancode(), action, event.modifiers());
    }
}
