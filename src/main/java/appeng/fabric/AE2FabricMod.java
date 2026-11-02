package appeng.fabric;

import java.util.ArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.recipe.v1.sync.RecipeSynchronization;
import net.fabricmc.fabric.api.resource.v1.ResourceLoader;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.packs.PackType;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.DeferredWorkQueue;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.ModLoader;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.neoforge.capabilities.RegisterCapabilitiesEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.AddServerReloadListenersEvent;
import net.neoforged.neoforge.event.OnDatapackSyncEvent;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.registries.NewRegistryEvent;
import net.neoforged.neoforge.registries.RegisterEvent;
import net.neoforged.neoforge.registries.RegistryCallbacks;

import appeng.core.AppEng;
import appeng.core.AppEngServer;
import appeng.fabric.shim.ShimCapabilities;
import appeng.fabric.shim.SimpleEventBus;

/**
 * Fabric entrypoint. Constructs AE2 like NeoForge would and then fires the NeoForge-style mod bus events in the same
 * order NeoForge does, so the AE2 code base can stay mostly unchanged.
 */
public class AE2FabricMod implements ModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger(AE2FabricMod.class);

    private static IEventBus modBus;
    private static ModContainer container;

    public static IEventBus modBus() {
        return modBus;
    }

    public static ModContainer container() {
        return container;
    }

    @Override
    public void onInitialize() {
        modBus = new SimpleEventBus("ae2-mod");
        container = new ModContainer(AppEng.MOD_ID, modBus);
        ModLoader.AE2_CONTAINER = container;

        FabricEventBridge.registerCommon();

        // Construct the mod (client or dedicated server variant)
        if (FabricLoader.getInstance().getEnvironmentType() == EnvType.CLIENT) {
            try {
                Class.forName("appeng.client.AppEngClient")
                        .getConstructor(IEventBus.class, ModContainer.class)
                        .newInstance(modBus, container);
            } catch (ReflectiveOperationException e) {
                throw new RuntimeException("Failed to construct AE2 client", e);
            }
        } else {
            new AppEngServer(modBus, container);
        }

        container.fireConfigLoading();

        // Registries
        var newRegistryEvent = new NewRegistryEvent();
        modBus.post(newRegistryEvent);
        newRegistryEvent.fillForFabric();

        var registryKeys = new ArrayList<ResourceKey<? extends Registry<?>>>();
        for (var registry : BuiltInRegistries.REGISTRY) {
            registryKeys.add(registry.key());
        }
        for (var key : registryKeys) {
            var registry = BuiltInRegistries.REGISTRY.getValue(key.identifier());
            modBus.post(new RegisterEvent(key, registry));
        }

        // Capabilities
        modBus.post(new RegisterCapabilitiesEvent());
        ShimCapabilities.exposeToFabric();

        // Networking
        modBus.post(new RegisterPayloadHandlersEvent());

        // Common setup
        var queue = new DeferredWorkQueue("common setup");
        modBus.post(new FMLCommonSetupEvent(container, queue));
        queue.runTasks();

        // Server reload listeners
        var serverData = ResourceLoader.get(PackType.SERVER_DATA);
        NeoForge.EVENT_BUS.post(new AddServerReloadListenersEvent(serverData::registerReloadListener));

        // Recipe synchronization for client-side recipe viewers
        NeoForge.EVENT_BUS.post(new OnDatapackSyncEvent(type -> {
        }));
        for (var serializer : BuiltInRegistries.RECIPE_SERIALIZER) {
            var id = BuiltInRegistries.RECIPE_SERIALIZER.getKey(serializer);
            if (id != null && id.getNamespace().equals(AppEng.MOD_ID)) {
                RecipeSynchronization.synchronizeRecipeSerializer(serializer);
            }
        }

        RegistryCallbacks.bakeAll();

        LOG.info("Applied Energistics 2 (Fabric port) initialized");
    }
}
