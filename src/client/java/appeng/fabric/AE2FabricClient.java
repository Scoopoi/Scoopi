package appeng.fabric;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientBlockEntityEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientChunkEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.model.loading.v1.ModelLoadingPlugin;
import net.fabricmc.fabric.api.client.model.loading.v1.UnbakedExtraModel;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.recipe.v1.sync.ClientRecipeSynchronizedEvent;
import net.fabricmc.fabric.api.event.client.player.ClientHotbarScrollEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.resources.model.ModelBaker;
import net.minecraft.client.resources.model.ResolvableModel;
import net.minecraft.world.item.crafting.RecipeMap;
import net.minecraft.world.item.crafting.RecipeType;
import net.neoforged.fml.DeferredWorkQueue;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;
import net.neoforged.neoforge.client.event.AddClientReloadListenersEvent;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.client.event.InitializeClientRegistriesEvent;
import net.neoforged.neoforge.client.event.InputEvent;
import net.neoforged.neoforge.client.event.ModelEvent;
import net.neoforged.neoforge.client.event.RecipesReceivedEvent;
import net.neoforged.neoforge.client.event.RegisterBlockStateModels;
import net.neoforged.neoforge.client.event.RegisterClientTooltipComponentFactoriesEvent;
import net.neoforged.neoforge.client.event.RegisterColorHandlersEvent;
import net.neoforged.neoforge.client.event.RegisterItemModelsEvent;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;
import net.neoforged.neoforge.client.event.RegisterParticleGroupsEvent;
import net.neoforged.neoforge.client.event.RegisterParticleProvidersEvent;
import net.neoforged.neoforge.client.event.RegisterPictureInPictureRenderersEvent;
import net.neoforged.neoforge.client.event.RegisterRangeSelectItemModelPropertyEvent;
import net.neoforged.neoforge.client.event.RegisterRenderPipelinesEvent;
import net.neoforged.neoforge.client.model.standalone.StandaloneModelKey;
import net.neoforged.neoforge.client.model.standalone.UnbakedStandaloneModel;
import net.neoforged.neoforge.client.network.event.RegisterClientPayloadHandlersEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.level.LevelEvent;

import appeng.fabric.shim.ShimClientHooks;

/**
 * Fabric client entrypoint. Fires the NeoForge-style client registration events AE2 listens to, each of which
 * delegates to the corresponding Fabric API registry.
 */
public class AE2FabricClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        var modBus = AE2FabricMod.modBus();
        var gameBus = NeoForge.EVENT_BUS;

        ShimClientHooks.shiftDown = () -> Minecraft.getInstance().hasShiftDown();
        ShimClientHooks.rerenderHandler = (level, pos) -> {
            var state = level.getBlockState(pos);
            level.sendBlockUpdated(pos, state, state, 8);
        };

        modBus.post(new InitializeClientRegistriesEvent());
        modBus.post(new RegisterRenderPipelinesEvent());
        modBus.post(new RegisterKeyMappingsEvent());
        modBus.post(new RegisterMenuScreensEvent());
        modBus.post(new RegisterClientTooltipComponentFactoriesEvent());
        modBus.post(new AddClientReloadListenersEvent());
        modBus.post(new RegisterClientPayloadHandlersEvent());
        modBus.post(new EntityRenderersEvent.RegisterLayerDefinitions());
        modBus.post(new EntityRenderersEvent.RegisterRenderers());
        modBus.post(new RegisterParticleProvidersEvent());
        modBus.post(new RegisterParticleGroupsEvent());
        modBus.post(new RegisterBlockStateModels());
        modBus.post(new RegisterItemModelsEvent());
        modBus.post(new RegisterRangeSelectItemModelPropertyEvent());
        modBus.post(new RegisterColorHandlersEvent.ItemTintSources());
        modBus.post(new RegisterColorHandlersEvent.BlockTintSources());
        modBus.post(new RegisterPictureInPictureRenderersEvent());

        // Standalone models -> Fabric extra models
        Map<StandaloneModelKey<?>, UnbakedStandaloneModel<?>> standaloneModels = new LinkedHashMap<>();
        modBus.post(new ModelEvent.RegisterStandalone(standaloneModels));
        ModelLoadingPlugin.register(context -> {
            for (var entry : standaloneModels.entrySet()) {
                addExtraModel(context, entry.getKey(), entry.getValue());
            }
        });

        var queue = new DeferredWorkQueue("client setup");
        modBus.post(new FMLClientSetupEvent(AE2FabricMod.container(), queue));
        queue.runTasks();

        // Game events
        ClientTickEvents.START_CLIENT_TICK.register(client -> gameBus.post(new ClientTickEvent.Pre()));
        ClientTickEvents.END_CLIENT_TICK.register(client -> gameBus.post(new ClientTickEvent.Post()));
        ClientPlayConnectionEvents.JOIN
                .register((handler, sender, client) -> gameBus.post(new ClientPlayerNetworkEvent.LoggingIn()));
        ClientPlayConnectionEvents.DISCONNECT
                .register((handler, client) -> gameBus.post(new ClientPlayerNetworkEvent.LoggingOut()));
        ClientHotbarScrollEvents.ALLOW.register((inventory, oldSlot, newSlot, scrollX, scrollY) -> {
            var evt = gameBus.post(new InputEvent.MouseScrollingEvent(scrollX, scrollY));
            return !evt.isCanceled();
        });
        ClientBlockEntityEvents.BLOCK_ENTITY_LOAD.register((blockEntity, level) -> blockEntity.onLoad());
        ClientChunkEvents.CHUNK_UNLOAD.register((level, chunk) -> {
            for (var blockEntity : chunk.getBlockEntities().values()) {
                blockEntity.onChunkUnloaded();
            }
        });
        net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLevelEvents.AFTER_CLIENT_LEVEL_CHANGE
                .register((client, level) -> {
                    // NeoForge fires a level load for the new client level
                    gameBus.post(new LevelEvent.Load(level));
                });

        ClientRecipeSynchronizedEvent.EVENT.register((client, recipes) -> {
            var all = recipes.recipes();
            var types = new HashSet<RecipeType<?>>();
            for (var holder : all) {
                types.add(holder.value().getType());
            }
            gameBus.post(new RecipesReceivedEvent(types, RecipeMap.create(all)));
        });
    }

    private static <T> void addExtraModel(ModelLoadingPlugin.Context context, StandaloneModelKey<T> key,
            UnbakedStandaloneModel<?> unbaked) {
        @SuppressWarnings("unchecked")
        var typed = (UnbakedStandaloneModel<T>) unbaked;
        context.addModel(key.fabricKey(), new UnbakedExtraModel<T>() {
            @Override
            public T bake(ModelBaker baker) {
                return typed.bake(baker, key::getName);
            }

            @Override
            public void resolveDependencies(ResolvableModel.Resolver resolver) {
                typed.resolveDependencies(resolver);
            }
        });
    }

    /** Called from the keyboard mixin. */
    public static void onKey(int key, int scanCode, int action, int modifiers) {
        NeoForge.EVENT_BUS.post(new InputEvent.Key(key, scanCode, action, modifiers));
    }
}
