package net.neoforged.neoforge.common;

import org.jspecify.annotations.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;

public final class CommonHooks {
    private static final ThreadLocal<Player> CRAFTING_PLAYER = new ThreadLocal<>();

    private CommonHooks() {
    }

    @Nullable
    public static Player getCraftingPlayer() {
        return CRAFTING_PLAYER.get();
    }

    public static void setCraftingPlayer(@Nullable Player player) {
        CRAFTING_PLAYER.set(player);
    }

    /**
     * Creates the left-click event. Fabric protection mods hook {@code AttackBlockCallback}, so we consult it and
     * pre-cancel the event if it fails.
     */
    public static PlayerInteractEvent.LeftClickBlock onLeftClickBlock(Player player, BlockPos pos, Direction face,
            ServerboundPlayerActionPacket.Action action) {
        var evt = new PlayerInteractEvent.LeftClickBlock(player, pos, face,
                PlayerInteractEvent.LeftClickBlock.Action.convert(action));
        var result = net.fabricmc.fabric.api.event.player.AttackBlockCallback.EVENT.invoker()
                .interact(player, player.level(), InteractionHand.MAIN_HAND, pos, face);
        if (result != InteractionResult.PASS && !result.consumesAction()) {
            evt.setCanceled(true);
        }
        return evt;
    }
}
