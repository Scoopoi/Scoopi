package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

import net.minecraft.server.MinecraftServer;
import net.neoforged.fml.util.thread.SidedThreadGroups;

/**
 * NeoForge runs the server thread inside {@link SidedThreadGroups#SERVER}; AE2 uses this to detect the logical side.
 */
@Mixin(MinecraftServer.class)
public abstract class ServerThreadGroupMixin {
    @Redirect(method = "spin", at = @At(value = "NEW", target = "(Ljava/lang/Runnable;Ljava/lang/String;)Ljava/lang/Thread;"))
    private static Thread ae2_createServerThread(Runnable runnable, String name) {
        return new Thread(SidedThreadGroups.SERVER, runnable, name);
    }
}
