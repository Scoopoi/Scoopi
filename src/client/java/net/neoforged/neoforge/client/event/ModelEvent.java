package net.neoforged.neoforge.client.event;

import java.util.Map;

import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;
import net.neoforged.neoforge.client.model.standalone.StandaloneModelKey;
import net.neoforged.neoforge.client.model.standalone.UnbakedStandaloneModel;

public abstract class ModelEvent extends Event implements IModBusEvent {
    public static class RegisterStandalone extends ModelEvent {
        private final Map<StandaloneModelKey<?>, UnbakedStandaloneModel<?>> modelMap;

        public RegisterStandalone(Map<StandaloneModelKey<?>, UnbakedStandaloneModel<?>> modelMap) {
            this.modelMap = modelMap;
        }

        public <T> void register(StandaloneModelKey<T> modelKey, UnbakedStandaloneModel<T> baker) {
            modelMap.put(modelKey, baker);
        }
    }
}
