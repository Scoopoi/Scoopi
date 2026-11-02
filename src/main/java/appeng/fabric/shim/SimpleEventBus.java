package appeng.fabric.shim;

import java.lang.invoke.MethodHandles;
import java.lang.invoke.SerializedLambda;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.neoforged.bus.api.Event;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.ICancellableEvent;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.bus.api.SubscribeEvent;

/**
 * Minimal re-implementation of the NeoForge event bus. Listener event types are resolved from lambda metadata or
 * {@link SubscribeEvent} method signatures. Dispatch matches on event class hierarchy.
 */
public class SimpleEventBus implements IEventBus {
    private static final Logger LOG = LoggerFactory.getLogger(SimpleEventBus.class);

    private record Listener(Class<?> type, EventPriority priority, boolean receiveCanceled, Consumer<Object> consumer,
            Object owner, long order) {
    }

    private final String name;
    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    private final Map<Class<?>, List<Listener>> cache = new ConcurrentHashMap<>();
    private long counter;

    public SimpleEventBus(String name) {
        this.name = name;
    }

    private synchronized void add(Listener l) {
        listeners.add(l);
        cache.clear();
    }

    private synchronized long nextOrder() {
        return counter++;
    }

    @Override
    public void register(Object target) {
        boolean isClass = target instanceof Class<?>;
        Class<?> cls = isClass ? (Class<?>) target : target.getClass();
        for (Class<?> c = cls; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                var ann = m.getAnnotation(SubscribeEvent.class);
                if (ann == null || m.getParameterCount() != 1) {
                    continue;
                }
                boolean isStatic = Modifier.isStatic(m.getModifiers());
                if (isStatic != isClass) {
                    continue;
                }
                m.setAccessible(true);
                var type = m.getParameterTypes()[0];
                Object inst = isClass ? null : target;
                add(new Listener(type, ann.priority(), ann.receiveCanceled(), evt -> {
                    try {
                        m.invoke(inst, evt);
                    } catch (java.lang.reflect.InvocationTargetException e) {
                        sneaky(e.getCause());
                    } catch (IllegalAccessException e) {
                        throw new RuntimeException(e);
                    }
                }, target, nextOrder()));
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static <E extends Throwable> void sneaky(Throwable t) throws E {
        throw (E) t;
    }

    @Override
    public synchronized void unregister(Object target) {
        listeners.removeIf(l -> l.owner == target);
        cache.clear();
    }

    @Override
    public <T extends Event> void addListener(Consumer<T> consumer) {
        addListener(EventPriority.NORMAL, false, consumer);
    }

    @Override
    public <T extends Event> void addListener(EventPriority priority, Consumer<T> consumer) {
        addListener(priority, false, consumer);
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T extends Event> void addListener(EventPriority priority, boolean receiveCanceled, Consumer<T> consumer) {
        Class<?> type = resolveType(consumer);
        add(new Listener(type, priority, receiveCanceled, (Consumer<Object>) consumer, null, nextOrder()));
    }

    @Override
    public <T extends Event> void addListener(Class<T> eventType, Consumer<T> consumer) {
        addListener(EventPriority.NORMAL, eventType, consumer);
    }

    @SuppressWarnings("unchecked")
    @Override
    public <T extends Event> void addListener(EventPriority priority, Class<T> eventType, Consumer<T> consumer) {
        add(new Listener(eventType, priority, false, (Consumer<Object>) consumer, null, nextOrder()));
    }

    @Override
    public <T extends Event> T post(T event) {
        var ls = cache.computeIfAbsent(event.getClass(), cls -> {
            var result = new ArrayList<Listener>();
            for (var l : listeners) {
                if (l.type.isAssignableFrom(cls)) {
                    result.add(l);
                }
            }
            result.sort(Comparator.comparing(Listener::priority).thenComparingLong(Listener::order));
            return result;
        });
        for (var l : ls) {
            if (event instanceof ICancellableEvent ce && ce.isCanceled() && !l.receiveCanceled) {
                continue;
            }
            l.consumer.accept(event);
        }
        return event;
    }

    /**
     * Resolve the event type of a lambda / method reference consumer via its serialized form, or a generic interface.
     */
    private Class<?> resolveType(Consumer<?> consumer) {
        // Try generic superinterfaces (anonymous/real classes)
        for (Type t : consumer.getClass().getGenericInterfaces()) {
            if (t instanceof ParameterizedType pt && pt.getRawType() == Consumer.class
                    && pt.getActualTypeArguments()[0] instanceof Class<?> c) {
                return c;
            }
        }
        var type = LambdaTypeResolver.resolveFirstParameter(consumer);
        if (type != null) {
            return type;
        }
        throw new IllegalArgumentException("[" + name + "] Cannot determine event type of listener " + consumer
                + ". Use addListener(Class, Consumer) instead.");
    }
}
