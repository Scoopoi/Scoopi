package appeng.fabric;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerBlockEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerChunkEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLevelEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackBlockCallback;
import net.fabricmc.fabric.api.event.player.PlayerPickItemEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.ChunkEvent;
import net.neoforged.neoforge.event.level.LevelEvent;
import net.neoforged.neoforge.event.server.ServerAboutToStartEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.LevelTickEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

import appeng.fabric.shim.CapabilityLevelHooks;

/**
 * Forwards Fabric API callbacks to the NeoForge-style game event bus ({@link NeoForge#EVENT_BUS}) that AE2 listens to.
 */
public final class FabricEventBridge {
    private FabricEventBridge() {
    }

    public static void registerCommon() {
        var bus = NeoForge.EVENT_BUS;

        // Server lifecycle
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            ServerLifecycleHooks.setCurrentServer(server);
            bus.post(new ServerAboutToStartEvent(server));
        });
        ServerLifecycleEvents.SERVER_STARTED.register(server -> bus.post(new ServerStartedEvent(server)));
        ServerLifecycleEvents.SERVER_STOPPING.register(server -> bus.post(new ServerStoppingEvent(server)));
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            bus.post(new ServerStoppedEvent(server));
            ServerLifecycleHooks.setCurrentServer(null);
        });

        // Ticks
        ServerTickEvents.START_SERVER_TICK.register(server -> bus.post(new ServerTickEvent.Pre(() -> true, server)));
        ServerTickEvents.END_SERVER_TICK.register(server -> bus.post(new ServerTickEvent.Post(() -> true, server)));
        ServerTickEvents.START_LEVEL_TICK.register(level -> bus.post(new LevelTickEvent.Pre(() -> true, level)));
        ServerTickEvents.END_LEVEL_TICK.register(level -> {
            bus.post(new LevelTickEvent.Post(() -> true, level));
            if (level.getGameTime() % 200 == 0) {
                CapabilityLevelHooks.clean(level);
            }
        });

        // Levels
        ServerLevelEvents.LOAD.register((server, level) -> bus.post(new LevelEvent.Load(level)));
        ServerLevelEvents.UNLOAD.register((server, level) -> bus.post(new LevelEvent.Unload(level)));

        // Chunks
        ServerChunkEvents.CHUNK_LOAD.register((level, chunk, generated) -> {
            CapabilityLevelHooks.invalidate(level, chunk.getPos());
            bus.post(new ChunkEvent.Load(chunk, generated));
        });
        ServerChunkEvents.CHUNK_UNLOAD.register((level, chunk) -> {
            onChunkUnload(chunk);
            CapabilityLevelHooks.invalidate(level, chunk.getPos());
        });

        // Block entities
        ServerBlockEntityEvents.BLOCK_ENTITY_LOAD.register((blockEntity, level) -> blockEntity.onLoad());

        // Commands
        CommandRegistrationCallback.EVENT.register((dispatcher, context, selection) -> bus
                .post(new RegisterCommandsEvent(dispatcher, selection, context)));

        // Interaction
        UseBlockCallback.EVENT.register((player, level, hand, hitResult) -> {
            var evt = bus.post(new PlayerInteractEvent.RightClickBlock(player, hand, hitResult.getBlockPos(),
                    hitResult));
            if (evt.isCanceled()) {
                return evt.getCancellationResult();
            }
            if (player.isSpectator()) {
                return InteractionResult.PASS;
            }
            var stack = player.getItemInHand(hand);
            if (!stack.isEmpty()) {
                var result = stack.getItem().onItemUseFirst(stack, new UseOnContext(player, hand, hitResult));
                if (result != InteractionResult.PASS) {
                    return result;
                }
            }
            return InteractionResult.PASS;
        });
        AttackBlockCallback.EVENT.register((player, level, hand, pos, direction) -> {
            var evt = bus.post(new PlayerInteractEvent.LeftClickBlock(player, pos, direction,
                    PlayerInteractEvent.LeftClickBlock.Action.START));
            return evt.isCanceled() ? InteractionResult.FAIL : InteractionResult.PASS;
        });

        // Pick block with player context (cable bus parts, facades)
        PlayerPickItemEvents.BLOCK.register((player, pos, state, includeData) -> {
            if (state.getBlock().getClass().getName().startsWith("appeng.")) {
                var stack = state.getBlock().getCloneItemStack(player.level(), pos, state, includeData, player);
                return stack.isEmpty() ? null : stack;
            }
            return null;
        });
    }

    public static void onChunkUnload(LevelChunk chunk) {
        for (var blockEntity : chunk.getBlockEntities().values()) {
            blockEntity.onChunkUnloaded();
        }
        NeoForge.EVENT_BUS.post(new ChunkEvent.Unload(chunk));
    }
}
