package appeng.fabric.shim;

import java.util.function.Consumer;
import java.util.regex.Pattern;

import org.jetbrains.annotations.Nullable;

/**
 * Determines the parameter type of a lambda/method-reference {@link Consumer}. Non-generic lambdas perform a
 * {@code checkcast} on their argument before invoking the target, so passing a probe object yields a
 * {@link ClassCastException} whose message names the expected type.
 */
final class LambdaTypeResolver {
    private static final Pattern CCE = Pattern.compile("cannot be cast to (?:class )?([\\w.$]+)");

    private static final class Probe {
    }

    private LambdaTypeResolver() {
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    @Nullable
    static Class<?> resolveFirstParameter(Consumer<?> consumer) {
        try {
            ((Consumer) consumer).accept(new Probe());
        } catch (ClassCastException e) {
            var msg = e.getMessage();
            if (msg != null) {
                var m = CCE.matcher(msg);
                if (m.find()) {
                    try {
                        return Class.forName(m.group(1), false, consumer.getClass().getClassLoader());
                    } catch (ClassNotFoundException ex) {
                        try {
                            return Class.forName(m.group(1), false, LambdaTypeResolver.class.getClassLoader());
                        } catch (ClassNotFoundException ignored) {
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
        }
        return null;
    }
}
