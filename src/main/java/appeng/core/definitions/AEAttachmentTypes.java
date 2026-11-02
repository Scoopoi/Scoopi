package appeng.core.definitions;

import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.IEventBus;

import appeng.core.AppEng;

/**
 * Fabric port: uses the Fabric Data Attachment API.
 */
public final class AEAttachmentTypes {
    public static final AttachmentType<Boolean> HOLDING_CTRL = AttachmentRegistry.create(AppEng.makeId("ctrl"));

    public static boolean isHoldingCtrl(Player player) {
        return player.getAttachedOrElse(HOLDING_CTRL, false);
    }

    public static void setHoldingCtrl(Player player, boolean value) {
        player.setAttached(HOLDING_CTRL, value);
    }

    public static void register(IEventBus modEventBus) {
        // Registered on class load
    }
}
