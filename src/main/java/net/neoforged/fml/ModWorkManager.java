package net.neoforged.fml;

import java.util.concurrent.Executor;

public final class ModWorkManager {
    private ModWorkManager() {
    }

    public static Executor syncExecutor() {
        return Runnable::run;
    }

    public static Executor parallelExecutor() {
        return Runnable::run;
    }
}
