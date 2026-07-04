const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_VERSION = "3.0.0";

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function addManifestChildOnce(parent, tag, attrs, uniqueAttr) {
  const list = ensureArray(parent[tag]);
  const exists = list.some((item) => item?.$?.[uniqueAttr] === attrs[uniqueAttr]);
  if (!exists) list.push({ $: attrs });
  parent[tag] = list;
}

function addWorkoutManifestEntries(androidManifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  addManifestChildOnce(app, "receiver", {
    "android:name": ".widget.KakWorkoutWidgetProvider",
    "android:exported": "true",
  }, "android:name");
  const receivers = ensureArray(app.receiver);
  const provider = receivers.find((entry) => entry.$["android:name"] === ".widget.KakWorkoutWidgetProvider");
  if (!provider) throw new Error("Failed to register KakWorkoutWidgetProvider");
  provider["intent-filter"] = [{ action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] }];
  provider["meta-data"] = [{ $: { "android:name": "android.appwidget.provider", "android:resource": "@xml/kak_workout_widget_info" } }];
  app.receiver = receivers;

  addManifestChildOnce(app, "receiver", {
    "android:name": ".widget.KakWorkoutWidgetActionReceiver",
    "android:exported": "true",
  }, "android:name");

  // Notification foreground service (lock screen + notification shade).
  // Force-update the service entry so the foreground service type is always correct.
  // Using mediaPlayback so the system shows a Spotify-style lockscreen card via MediaSession.
  const services = ensureArray(app.service);
  const overlaySvcIdx = services.findIndex((s) => s.$?.["android:name"] === ".widget.KakWorkoutOverlayService");
  const overlaySvcEntry = {
    $: {
      "android:name": ".widget.KakWorkoutOverlayService",
      "android:exported": "false",
      "android:foregroundServiceType": "mediaPlayback",
    },
  };
  if (overlaySvcIdx >= 0) {
    services[overlaySvcIdx] = overlaySvcEntry;
  } else {
    services.push(overlaySvcEntry);
  }
  app.service = services;

  // Legacy floating overlay service — kept registered but disabled in code (widget + notification only)
  addManifestChildOnce(app, "service", {
    "android:name": ".widget.KakWorkoutFloatingOverlayService",
    "android:exported": "false",
  }, "android:name");

  const permissions = ensureArray(androidManifest.manifest["uses-permission"]);
  const requiredPerms = [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.POST_NOTIFICATIONS",
  ];
  for (const perm of requiredPerms) {
    if (!permissions.some((p) => p.$?.["android:name"] === perm)) {
      permissions.push({ $: { "android:name": perm } });
    }
  }
  const removePerms = new Set([
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  ]);
  androidManifest.manifest["uses-permission"] = permissions.filter(
    (p) => !removePerms.has(p.$?.["android:name"])
  );
}

function patchMainApplication(projectRoot, packageName) {
  const mainRoot = path.join(projectRoot, "android/app/src/main/java", ...packageName.split("."));
  const candidates = [path.join(mainRoot, "MainApplication.kt"), path.join(mainRoot, "MainApplication.java")];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("KakWorkoutWidgetPackage")) return;

  if (file.endsWith(".kt")) {
    src = src.replace(/(import com\.facebook\.react\.PackageList\n)/, `$1import ${packageName}.widget.KakWorkoutWidgetPackage\n`);
    // Modern Expo Kotlin template uses .apply { } block
    if (src.includes("PackageList(this).packages.apply")) {
      src = src.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{[^\n]*\n)/,
        `$1              add(KakWorkoutWidgetPackage())\n`
      );
    } else {
      // Legacy pattern: val packages = PackageList(this).packages
      src = src.replace(/(val packages = PackageList\(this\)\.packages\n)/, `$1        packages.add(KakWorkoutWidgetPackage())\n`);
    }
  } else {
    src = src.replace(/(import com\.facebook\.react\.PackageList;\n)/, `$1import ${packageName}.widget.KakWorkoutWidgetPackage;\n`);
    src = src.replace(/(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);\n)/, `$1        packages.add(new KakWorkoutWidgetPackage());\n`);
  }
  fs.writeFileSync(file, src);
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function javaSources(packageName) {
  const pkg = `${packageName}.widget`;
  return {
    "KakWorkoutWidgetPackage.java": `package ${pkg};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class KakWorkoutWidgetPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new KakWorkoutWidgetModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`,
    "KakWorkoutWidgetState.java": `package ${pkg};

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

class KakWorkoutWidgetState {
  static final String PREFS = "kak_workout_widget";
  static final String ACTION_REFRESH = "${packageName}.widget.REFRESH";
  static final String ACTION_COMPLETE_SET = "${packageName}.widget.COMPLETE_SET";
  static final String ACTION_TICK_REP = "${packageName}.widget.TICK_REP";
  static final String ACTION_SKIP_REST = "${packageName}.widget.SKIP_REST";
  static final String ACTION_OPEN = "${packageName}.widget.OPEN";
  static final String ACTION_STOP = "${packageName}.widget.STOP";
  static final String ACTION_FLOATING_SHOW = "${packageName}.widget.FLOATING_SHOW";
  static final String ACTION_FLOATING_HIDE = "${packageName}.widget.FLOATING_HIDE";
  static final String ACTION_FLOATING_UPDATE = "${packageName}.widget.FLOATING_UPDATE";
  static final String ACTION_FLOATING_DISMISS = "${packageName}.widget.FLOATING_DISMISS";

  final boolean active;
  final boolean controlsVisible;
  final String workoutName;
  final String elapsedLabel;
  final String progressLabel;
  final String shortExerciseName;
  final String setLabel;
  final String nextSetId;
  final int nextSetNumber;
  final int nextSetReps;
  final float nextSetWeight;
  final int repsCompleted;
  final long restEndsAtMs;
  final boolean complete;
  final int completedSetsCount;
  final int totalSetsCount;
  final int defaultRestSeconds;
  final long startedAtMs;
  final String nextExerciseName;

  private KakWorkoutWidgetState(SharedPreferences prefs) {
    active = prefs.getBoolean("active", false);
    controlsVisible = prefs.getBoolean("controlsVisible", false);
    workoutName = prefs.getString("workoutName", "Workout");
    elapsedLabel = prefs.getString("elapsedLabel", "0s");
    progressLabel = prefs.getString("progressLabel", "0/0 sets");
    shortExerciseName = prefs.getString("shortExerciseName", "Active workout");
    setLabel = prefs.getString("setLabel", "");
    nextSetId = prefs.getString("nextSetId", "");
    nextSetNumber = prefs.getInt("nextSetNumber", 0);
    nextSetReps = Math.max(1, prefs.getInt("nextSetReps", 1));
    nextSetWeight = prefs.getFloat("nextSetWeight", 0f);
    repsCompleted = prefs.getInt("repsCompleted", 0);
    restEndsAtMs = prefs.getLong("restEndsAtMs", 0L);
    complete = prefs.getBoolean("complete", false);
    completedSetsCount = prefs.getInt("completedSetsCount", 0);
    totalSetsCount = prefs.getInt("totalSetsCount", 0);
    defaultRestSeconds = Math.max(0, prefs.getInt("defaultRestSeconds", 90));
    startedAtMs = prefs.getLong("startedAtMs", 0L);
    nextExerciseName = prefs.getString("nextExerciseName", "");
  }

  static KakWorkoutWidgetState read(Context context) {
    return new KakWorkoutWidgetState(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
  }

  static void setControlsVisible(Context context, boolean visible) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("controlsVisible", visible)
      .apply();
    if (visible) {
      setOverlayDismissed(context, false);
    }
  }

  static boolean isOverlayDismissed(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getBoolean("overlayDismissed", false);
  }

  static void setOverlayDismissed(Context context, boolean dismissed) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("overlayDismissed", dismissed)
      .apply();
  }

  static void resetRepProgress(Context context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("repsCompleted", 0).apply();
  }

  static int tickRep(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    KakWorkoutWidgetState state = new KakWorkoutWidgetState(prefs);
    if (!state.active || state.complete || state.isResting()
        || state.nextSetId == null || state.nextSetId.length() == 0) {
      return state.repsCompleted;
    }
    int next = Math.min(state.nextSetReps, state.repsCompleted + 1);
    prefs.edit().putInt("repsCompleted", next).apply();
    return next;
  }

  static void skipRest(Context context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong("restEndsAtMs", 0L)
      .apply();
  }

  static String completeCurrentSetLocally(Context context, String expectedSetId) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    KakWorkoutWidgetState state = new KakWorkoutWidgetState(prefs);
    if (!state.active || state.complete || state.isResting()) return null;
    if (state.nextSetId == null || state.nextSetId.length() == 0) return null;
    if (expectedSetId != null && expectedSetId.length() > 0 && !expectedSetId.equals(state.nextSetId)) {
      return null;
    }

    String completedSetId = state.nextSetId;
    int completed = state.completedSetsCount + 1;
    int total = state.totalSetsCount > 0 ? state.totalSetsCount : completed;
    long restEnds = state.defaultRestSeconds > 0
      ? System.currentTimeMillis() + state.defaultRestSeconds * 1000L
      : 0L;

    JSONArray remaining = new JSONArray();
    try {
      JSONArray source = new JSONArray(prefs.getString("remainingSetsJson", "[]"));
      boolean removed = false;
      for (int i = 0; i < source.length(); i++) {
        JSONObject item = source.getJSONObject(i);
        String setId = item.optString("setId", "");
        if (!removed && setId.equals(completedSetId)) {
          removed = true;
          continue;
        }
        remaining.put(item);
      }
    } catch (Exception ignored) {}

    SharedPreferences.Editor editor = prefs.edit()
      .putInt("completedSetsCount", completed)
      .putString("progressLabel", completed + "/" + total + " sets")
      .putInt("repsCompleted", 0)
      .putLong("restEndsAtMs", restEnds)
      .putString("remainingSetsJson", remaining.toString());

    appendPendingSync(editor, prefs, completedSetId);

    if (remaining.length() == 0) {
      editor.putBoolean("complete", true)
        .putLong("restEndsAtMs", 0L)      // clear rest timer so title never reads "Rest •…" on a finished workout
        .putString("nextSetId", "")
        .putString("setLabel", "")
        .putString("shortExerciseName", "Workout complete")
        .putString("nextExerciseName", "");
    } else {
      try {
        JSONObject next = remaining.getJSONObject(0);
        String nextEx = "";
        String current = next.optString("shortExerciseName", "");
        for (int i = 1; i < remaining.length(); i++) {
          String ex = remaining.getJSONObject(i).optString("shortExerciseName", "");
          if (ex.length() > 0 && !ex.equals(current)) { nextEx = ex; break; }
        }
        editor.putBoolean("complete", false)
          .putString("nextSetId", next.optString("setId", ""))
          .putInt("nextSetNumber", next.optInt("setNumber", 0))
          .putInt("nextSetReps", Math.max(1, next.optInt("reps", 1)))
          .putFloat("nextSetWeight", (float) next.optDouble("weight", 0))
          .putString("shortExerciseName", next.optString("shortExerciseName", "Active workout"))
          .putString("setLabel", next.optString("setLabel", ""))
          .putString("nextExerciseName", nextEx);
      } catch (Exception ignored) {}
    }
    editor.apply();
    return completedSetId;
  }

  private static void appendPendingSync(SharedPreferences.Editor editor, SharedPreferences prefs, String setId) {
    if (setId == null || setId.length() == 0) return;
    String existing = prefs.getString("pendingSyncSetIds", "");
    if (hasPendingSyncSetId(existing, setId)) return;
    editor.putString("pendingSyncSetIds", existing.length() == 0 ? setId : existing + "," + setId);
  }

  private static boolean hasPendingSyncSetId(String existing, String setId) {
    if (existing == null || existing.length() == 0) return false;
    for (String part : existing.split(",")) {
      if (setId.equals(part)) return true;
    }
    return false;
  }

  static void removePendingSyncSetId(Context context, String setId) {
    if (setId == null || setId.length() == 0) return;
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String raw = prefs.getString("pendingSyncSetIds", "");
    if (raw == null || raw.length() == 0) return;
    StringBuilder next = new StringBuilder();
    for (String part : raw.split(",")) {
      if (part == null || part.length() == 0 || setId.equals(part)) continue;
      if (next.length() > 0) next.append(",");
      next.append(part);
    }
    prefs.edit().putString("pendingSyncSetIds", next.toString()).apply();
  }

  static String[] getPendingSyncSetIds(Context context) {
    String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("pendingSyncSetIds", "");
    if (raw == null || raw.length() == 0) return new String[0];
    return raw.split(",");
  }

  static void clearPendingSyncSetIds(Context context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("pendingSyncSetIds").apply();
  }

  boolean isResting() {
    return restEndsAtMs > System.currentTimeMillis();
  }

  int restSecondsLeft() {
    if (!isResting()) return 0;
    return Math.max(1, (int) Math.ceil((restEndsAtMs - System.currentTimeMillis()) / 1000.0));
  }

  String barTitle() {
    if (!active) return "Kak Fit";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    return workoutName + " • " + liveElapsedLabel();
  }

  /** Home widget / lockscreen title — exercise name without elapsed (Chronometer shows time). */
  String widgetTitleLine() {
    if (!active) return "Kak Fit";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    if (complete) return workoutName + " — done";
    return shortExerciseName;
  }

  String barSubtitle() {
    if (!active) return "Start a workout";
    if (complete) return "All sets complete";
    if (isResting()) {
      String next = nextExerciseLabel();
      return next.length() > 0 ? next : "Up next • " + shortExerciseName;
    }
    // Show set detail with rep counter in brackets — avoids duplicate "8 reps • 0/8 reps"
    String detail = setDetailLine();
    String rep = repsCompleted + "/" + nextSetReps;
    return detail.length() > 0 ? detail + "  [" + rep + "]" : "Set " + nextSetNumber + "  [" + rep + "]";
  }

  String setDetailLine() {
    if (!active || complete) return "";
    if (setLabel != null && setLabel.length() > 0 && !setLabel.contains("?")) return setLabel;
    String weight = nextSetWeight > 0 ? String.valueOf((int) nextSetWeight) + "kg × " : "";
    return "Set " + nextSetNumber + " • " + weight + nextSetReps + " reps";
  }

  String nextExerciseLabel() {
    if (nextExerciseName == null || nextExerciseName.length() == 0) return "";
    return "Next: " + nextExerciseName;
  }

  String repTickLabel() {
    if (!active || complete || isResting()) return "";
    boolean done = repsCompleted >= nextSetReps;
    return (done ? "Done " : "[ ] ") + repsCompleted + "/" + nextSetReps;
  }

  /** Lock-screen MediaStyle primary line — exercise name, not generic "Workout". */
  String lockTitle() {
    if (!active) return "Kak Fit";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    if (complete) return "Workout complete";
    return shortExerciseName;
  }

  /** Lock-screen MediaStyle secondary line. */
  String lockSubtitle() {
    if (!active) return "Start a workout in Kak Fit";
    if (isResting()) return "Up next • " + shortExerciseName;
    if (complete) return progressLabel;
    return setDetailLine() + " • " + repProgressLabel();
  }

  /** Lock-screen third line / description. */
  String lockDescription() {
    if (!active) return "";
    String next = nextExerciseLabel();
    if (isResting() && next.length() > 0) return next + " • " + progressLabel;
    if (!isResting() && !complete && next.length() > 0) return progressLabel + " • " + next;
    return progressLabel;
  }

  String repProgressLabel() {
    if (!active) return "";
    if (isResting()) return "Rest before next set";
    if (complete) return "All sets done";
    return repsCompleted + "/" + nextSetReps + " reps";
  }

  // ── Notification shade helpers ───────────────────────────────────────────

  /** "Push Day A  ·  3:24" — small header line in notification big view. */
  String workoutHeaderLabel() {
    if (!active) return "";
    return workoutName + "  ·  " + liveElapsedLabel();
  }

  /** Exercise name for the notification big view title line. */
  String exerciseLabel() {
    if (!active) return "No active workout";
    if (complete) return "Workout complete  ✓";
    return shortExerciseName;
  }

  /** "1:30" or "45s" — countdown label for rest timer display. */
  String restTimerLabel() {
    int secs = restSecondsLeft();
    int m = secs / 60;
    int s = secs % 60;
    if (m > 0) return m + ":" + (s < 10 ? "0" + s : String.valueOf(s));
    return secs + "s";
  }

  /** 0–100 progress where 100 = just started, 0 = done. */
  int restTimerProgressPct() {
    if (!isResting() || defaultRestSeconds <= 0) return 0;
    long totalMs = (long) defaultRestSeconds * 1000L;
    long remaining = restEndsAtMs - System.currentTimeMillis();
    return (int) Math.max(0, Math.min(100, 100L * remaining / totalMs));
  }

  // Home-screen widget labels
  String title() {
    if (!active) return "No active workout";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    return workoutName + " • " + elapsedLabel;
  }

  String exerciseLine() {
    if (!active) return "Start a workout to use quick controls";
    if (complete) return "All sets complete";
    return shortExerciseName;
  }

  String detailLine() {
    if (!active) return "";
    if (complete) return progressLabel;
    if (isResting()) return "Get ready for the next set";
    if (setLabel != null && setLabel.length() > 0) return setLabel;
    return "Set " + nextSetNumber + " • " + nextSetReps + " reps";
  }

  private static String formatRest(int seconds) {
    int minutes = seconds / 60;
    int secs = seconds % 60;
    if (minutes > 0) return minutes + ":" + (secs < 10 ? "0" + secs : String.valueOf(secs));
    return seconds + "s";
  }

  private static String formatElapsed(long startedAtMs) {
    if (startedAtMs <= 0L) return "0s";
    int seconds = Math.max(0, (int) ((System.currentTimeMillis() - startedAtMs) / 1000L));
    int hours = seconds / 3600;
    int minutes = (seconds % 3600) / 60;
    if (hours > 0) return hours + "h " + minutes + "m";
    if (minutes > 0) return minutes + "m";
    return seconds + "s";
  }

  String liveElapsedLabel() {
    if (startedAtMs > 0L) return formatElapsed(startedAtMs);
    return elapsedLabel != null && elapsedLabel.length() > 0 ? elapsedLabel : "0s";
  }
}
`,
    "KakWorkoutWidgetModule.java": `package ${pkg};

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class KakWorkoutWidgetModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;
  private static boolean lifecycleRegistered = false;
  private static int activityReferences = 0;
  private static boolean isChangingConfigurations = false;

  KakWorkoutWidgetModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
    registerActivityLifecycleCallbacks(context);
  }

  private void registerActivityLifecycleCallbacks(ReactApplicationContext context) {
    if (lifecycleRegistered) return;
    lifecycleRegistered = true;
    ((Application) context.getApplicationContext()).registerActivityLifecycleCallbacks(
      new Application.ActivityLifecycleCallbacks() {
        @Override public void onActivityCreated(Activity activity, android.os.Bundle savedInstanceState) {}
        @Override public void onActivityStarted(Activity activity) {
          if (++activityReferences == 1 && !isChangingConfigurations) {
            onAppForeground(activity.getApplicationContext());
          }
        }
        @Override public void onActivityResumed(Activity activity) {}
        @Override public void onActivityPaused(Activity activity) {}
        @Override public void onActivityStopped(Activity activity) {
          isChangingConfigurations = activity.isChangingConfigurations();
          if (--activityReferences < 0) activityReferences = 0;
          if (activityReferences == 0 && !isChangingConfigurations) {
            onAppBackground(activity.getApplicationContext());
          }
        }
        @Override public void onActivitySaveInstanceState(Activity activity, android.os.Bundle outState) {}
        @Override public void onActivityDestroyed(Activity activity) {}
      }
    );
  }

  private static void onAppForeground(Context context) {
    KakWorkoutFloatingOverlayService.hide(context);
  }

  private static void onAppBackground(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("active", false)) return;
    refreshNotification(context);
    KakWorkoutWidgetProvider.updateAll(context);
  }

  static void refreshBackgroundSurfacesIfVisible(Context context) {
    KakWorkoutWidgetProvider.updateAll(context);
    refreshNotification(context);
  }

  @Override
  public String getName() { return "KakWorkoutWidget"; }

  @ReactMethod public void addListener(String eventName) {}
  @ReactMethod public void removeListeners(double count) {}

  @ReactMethod
  public void update(ReadableMap summary) {
    Context context = getReactApplicationContext();
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    String previousSetId = prefs.getString("nextSetId", "");
    String nextSetId = "";
    int nextSetNumber = 0, nextSetReps = 1;
    double nextSetWeight = 0;
    String setLabel = "";
    if (summary.hasKey("nextSet") && !summary.isNull("nextSet")) {
      ReadableMap next = summary.getMap("nextSet");
      nextSetId = next.hasKey("setId") && !next.isNull("setId") ? next.getString("setId") : "";
      nextSetNumber = next.hasKey("setNumber") ? next.getInt("setNumber") : 0;
      nextSetReps = next.hasKey("reps") && !next.isNull("reps") ? Math.max(1, next.getInt("reps")) : 1;
      nextSetWeight = next.hasKey("weight") && !next.isNull("weight") ? next.getDouble("weight") : 0;
      setLabel = next.hasKey("setLabel") && !next.isNull("setLabel") ? next.getString("setLabel") : "";
    }

    SharedPreferences.Editor editor = prefs.edit()
      .putBoolean("active", true)
      .putString("workoutName", summary.hasKey("workoutName") ? summary.getString("workoutName") : "Workout")
      .putString("elapsedLabel", summary.hasKey("elapsedLabel") ? summary.getString("elapsedLabel") : "0s")
      .putString("progressLabel", summary.hasKey("progressLabel") ? summary.getString("progressLabel") : "0/0 sets")
      .putInt("completedSetsCount", summary.hasKey("completedSets") ? summary.getInt("completedSets") : 0)
      .putInt("totalSetsCount", summary.hasKey("totalSets") ? summary.getInt("totalSets") : 0)
      .putInt("defaultRestSeconds", summary.hasKey("defaultRestSeconds") ? summary.getInt("defaultRestSeconds") : 90)
      .putString("shortExerciseName", summary.hasKey("shortExerciseName") ? summary.getString("shortExerciseName") : "Active workout")
      .putString("setLabel", setLabel)
      .putString("nextSetId", nextSetId)
      .putInt("nextSetNumber", nextSetNumber)
      .putInt("nextSetReps", nextSetReps)
      .putFloat("nextSetWeight", (float) nextSetWeight)
      .putBoolean("complete", summary.hasKey("isComplete") && summary.getBoolean("isComplete"));

    if (summary.hasKey("elapsedSeconds")) {
      int elapsedSeconds = Math.max(0, summary.getInt("elapsedSeconds"));
      editor.putLong("startedAtMs", System.currentTimeMillis() - elapsedSeconds * 1000L);
    }

    if (summary.hasKey("remainingSets") && !summary.isNull("remainingSets")) {
      ReadableArray remaining = summary.getArray("remainingSets");
      org.json.JSONArray json = new org.json.JSONArray();
      String nextExercise = "";
      String currentEx = summary.hasKey("shortExerciseName") ? summary.getString("shortExerciseName") : "";
      if (remaining != null) {
        for (int i = 0; i < remaining.size(); i++) {
          ReadableMap item = remaining.getMap(i);
          if (item == null) continue;
          org.json.JSONObject obj = new org.json.JSONObject();
          try {
            String exName = item.hasKey("shortExerciseName") && !item.isNull("shortExerciseName")
              ? item.getString("shortExerciseName") : "";
            if (nextExercise.length() == 0 && exName.length() > 0 && !exName.equals(currentEx)) {
              nextExercise = exName;
            }
            obj.put("setId", item.hasKey("setId") && !item.isNull("setId") ? item.getString("setId") : "");
            obj.put("setNumber", item.hasKey("setNumber") ? item.getInt("setNumber") : 0);
            obj.put("reps", item.hasKey("reps") && !item.isNull("reps") ? item.getInt("reps") : 1);
            obj.put("weight", item.hasKey("weight") && !item.isNull("weight") ? item.getDouble("weight") : 0);
            obj.put("shortExerciseName", item.hasKey("shortExerciseName") && !item.isNull("shortExerciseName") ? item.getString("shortExerciseName") : "");
            obj.put("setLabel", item.hasKey("setLabel") && !item.isNull("setLabel") ? item.getString("setLabel") : "");
            json.put(obj);
          } catch (Exception ignored) {}
        }
      }
      editor.putString("remainingSetsJson", json.toString());
      editor.putString("nextExerciseName", nextExercise);
    }

    if (!nextSetId.equals(previousSetId)) {
      editor.putInt("repsCompleted", 0);
      // Preserve an active rest countdown across JS-side widget refreshes,
      // otherwise we'd clobber the timer that completeCurrentSetLocally just set
      // when the JS bridge sends the post-completion summary a moment later.
      long existingRestEndsAtMs = prefs.getLong("restEndsAtMs", 0L);
      if (existingRestEndsAtMs <= System.currentTimeMillis()) {
        editor.putLong("restEndsAtMs", 0L);
      }
    }
    editor.apply();

    KakWorkoutWidgetProvider.updateAll(context);
    refreshNotification(context);
    refreshBackgroundSurfacesIfVisible(context);
  }

  @ReactMethod
  public void setControlsVisible(boolean visible) {
    Context context = getReactApplicationContext();
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    if (prefs.getBoolean("controlsVisible", false) == visible) return;
    KakWorkoutWidgetState.setControlsVisible(context, visible);
    KakWorkoutWidgetProvider.updateAll(context);
  }

  @ReactMethod
  public void tickRep() {
    Context context = getReactApplicationContext();
    context.sendBroadcast(new Intent(context, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_TICK_REP)
      .setPackage(context.getPackageName()));
  }

  @ReactMethod
  public void skipRest() {
    Context context = getReactApplicationContext();
    context.sendBroadcast(new Intent(context, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_SKIP_REST)
      .setPackage(context.getPackageName()));
  }

  @ReactMethod
  public void startRestTimer(int seconds) {
    if (seconds <= 0) return;
    Context context = getReactApplicationContext();
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong("restEndsAtMs", System.currentTimeMillis() + seconds * 1000L)
      .putInt("repsCompleted", 0)
      .apply();
    refreshNotification(context);
    refreshBackgroundSurfacesIfVisible(context);
    KakWorkoutWidgetProvider.updateAll(context);
  }

  /** Start or refresh the lockscreen / notification-shade foreground service while a workout is active. */
  static void refreshNotification(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("active", false)) return;
    try {
      Intent intent = new Intent(context, KakWorkoutOverlayService.class)
        .setAction(KakWorkoutWidgetState.ACTION_REFRESH);
      if (KakWorkoutOverlayService.isRunning()) {
        context.startService(intent);
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent);
      } else {
        context.startService(intent);
      }
    } catch (Exception ignored) {}
  }

  static void stopNotification(Context context) {
    try {
      context.startService(new Intent(context, KakWorkoutOverlayService.class)
        .setAction(KakWorkoutWidgetState.ACTION_STOP));
    } catch (Exception ignored) {}
  }

  @ReactMethod
  public void clear() {
    Context context = getReactApplicationContext();
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("active", false)
      .putBoolean("controlsVisible", false)
      .remove("nextSetId")
      .remove("startedAtMs")
      .remove("nextExerciseName")
      .apply();
    KakWorkoutWidgetProvider.updateAll(context);
    stopNotification(context);
  }

  @ReactMethod
  public void refreshLockscreen() {
    refreshNotification(getReactApplicationContext());
  }

  @ReactMethod
  public void canDrawOverlays(com.facebook.react.bridge.Promise promise) {
    promise.resolve(KakWorkoutFloatingOverlayService.canDraw(getReactApplicationContext()));
  }

  @ReactMethod
  public void openOverlaySettings() {
    try {
      android.content.Intent intent = new android.content.Intent(
        android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        android.net.Uri.parse("package:" + getReactApplicationContext().getPackageName())
      );
      android.app.Activity activity = getCurrentActivity();
      if (activity != null) {
        activity.startActivity(intent);
      } else {
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(intent);
      }
    } catch (Exception ignored) {}
  }

  @ReactMethod
  public void getPendingSyncSetIds(Promise promise) {
    try {
      String[] ids = KakWorkoutWidgetState.getPendingSyncSetIds(getReactApplicationContext());
      com.facebook.react.bridge.WritableArray array = Arguments.createArray();
      for (String id : ids) {
        if (id != null && id.length() > 0) array.pushString(id);
      }
      promise.resolve(array);
    } catch (Exception error) {
      promise.reject("pending_sync_error", error);
    }
  }

  @ReactMethod
  public void clearPendingSyncSetIds() {
    KakWorkoutWidgetState.clearPendingSyncSetIds(getReactApplicationContext());
  }

  @ReactMethod
  public void removePendingSyncSetId(String setId) {
    KakWorkoutWidgetState.removePendingSyncSetId(getReactApplicationContext(), setId);
  }

  static void emitCompleteSet(Context context, String setId) {
    if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
      WritableMap payload = Arguments.createMap();
      payload.putString("setId", setId == null ? "" : setId);
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("KakWorkoutWidgetCompleteSet", payload);
    }
  }

  static void emitSkipRest(Context context) {
    if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("KakWorkoutWidgetSkipRest", null);
    }
  }
}
`,
    "KakWorkoutWidgetActionReceiver.java": `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class KakWorkoutWidgetActionReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent.getAction();
    if (KakWorkoutWidgetState.ACTION_TICK_REP.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (!state.active || state.complete || state.isResting()) return;
      int completed = KakWorkoutWidgetState.tickRep(context);
      KakWorkoutWidgetState updated = KakWorkoutWidgetState.read(context);
      if (completed >= updated.nextSetReps && updated.nextSetId != null && updated.nextSetId.length() > 0) {
        String setId = KakWorkoutWidgetState.completeCurrentSetLocally(context, updated.nextSetId);
        if (setId != null) KakWorkoutWidgetModule.emitCompleteSet(context, setId);
      }
      KakWorkoutWidgetModule.refreshBackgroundSurfacesIfVisible(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_COMPLETE_SET.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (state.active && !state.isResting() && state.nextSetId != null && state.nextSetId.length() > 0) {
        String setId = KakWorkoutWidgetState.completeCurrentSetLocally(context, state.nextSetId);
        if (setId != null) KakWorkoutWidgetModule.emitCompleteSet(context, setId);
      }
      KakWorkoutWidgetModule.refreshBackgroundSurfacesIfVisible(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_SKIP_REST.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (!state.active || !state.isResting()) return;
      KakWorkoutWidgetState.skipRest(context);
      KakWorkoutWidgetModule.emitSkipRest(context);
      KakWorkoutWidgetModule.refreshBackgroundSurfacesIfVisible(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    // ACTION_OPEN and fallback: launch the app
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      context.startActivity(launch);
    }
  }
}
`,
    "KakWorkoutWidgetProvider.java": `package ${pkg};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;
import ${packageName}.R;

public class KakWorkoutWidgetProvider extends AppWidgetProvider {
  @Override
  public void onEnabled(Context context) {
    updateAll(context);
  }

  @Override
  public void onAppWidgetOptionsChanged(
      Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
    try {
      appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context));
    } catch (Exception error) {
      android.util.Log.e("KakWorkoutWidget", "onAppWidgetOptionsChanged failed", error);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      try {
        appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context));
      } catch (Exception error) {
        android.util.Log.e("KakWorkoutWidget", "onUpdate failed", error);
      }
    }
  }

  static void updateAll(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, KakWorkoutWidgetProvider.class);
    int[] ids = manager.getAppWidgetIds(component);
    for (int id : ids) {
      try {
        manager.updateAppWidget(id, buildRemoteViews(context));
      } catch (Exception error) {
        android.util.Log.e("KakWorkoutWidget", "updateAll failed", error);
      }
    }
  }

  /** Shared RemoteViews for home widget and lock-screen notification. */
  static RemoteViews buildRemoteViews(Context context) {
    try {
      return populateRemoteViews(context, new RemoteViews(context.getPackageName(), R.layout.kak_workout_widget));
    } catch (Throwable error) {
      android.util.Log.e("KakWorkoutWidget", "buildRemoteViews failed", error);
      RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.kak_workout_widget_fallback);
      fallback.setTextViewText(R.id.kak_fallback_text, "Kak Fit — tap Open");
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
      Intent open = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_OPEN);
      fallback.setOnClickPendingIntent(R.id.kak_fallback_root, PendingIntent.getBroadcast(context, 1199, open, flags));
      return fallback;
    }
  }

  private static RemoteViews populateRemoteViews(Context context, RemoteViews views) {
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);

    views.setTextViewText(R.id.kak_widget_title, state.widgetTitleLine());
    views.setTextViewText(R.id.kak_widget_detail, state.barSubtitle());
    views.setTextViewText(R.id.kak_widget_progress, state.active ? state.progressLabel : "Ready");
    views.setTextViewText(R.id.kak_widget_rep_tick, state.repTickLabel());
    if (state.active && !state.complete && !state.isResting() && state.repTickLabel().length() > 0) {
      views.setViewVisibility(R.id.kak_widget_rep_tick, android.view.View.VISIBLE);
    } else {
      views.setViewVisibility(R.id.kak_widget_rep_tick, android.view.View.GONE);
    }

    if (state.active && state.startedAtMs > 0 && !state.isResting()) {
      views.setViewVisibility(R.id.kak_widget_elapsed, android.view.View.VISIBLE);
      views.setTextViewText(R.id.kak_widget_elapsed, state.liveElapsedLabel());
    } else {
      views.setViewVisibility(R.id.kak_widget_elapsed, android.view.View.GONE);
    }

    String nextLabel = state.nextExerciseLabel();
    if (nextLabel.length() > 0 && state.active && !state.complete) {
      views.setViewVisibility(R.id.kak_widget_next, android.view.View.VISIBLE);
      views.setTextViewText(R.id.kak_widget_next, nextLabel);
    } else {
      views.setViewVisibility(R.id.kak_widget_next, android.view.View.GONE);
    }

    if (state.isResting()) {
      views.setViewVisibility(R.id.kak_widget_rest_time, android.view.View.VISIBLE);
      views.setTextViewText(R.id.kak_widget_rest_time, "Rest " + state.restTimerLabel());
      views.setViewVisibility(R.id.kak_widget_rep_tick, android.view.View.GONE);
    } else {
      views.setViewVisibility(R.id.kak_widget_rest_time, android.view.View.GONE);
    }

    if (state.isResting()) {
      views.setViewVisibility(R.id.kak_bar_btn_rep, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_set, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_skip, android.view.View.VISIBLE);
      views.setViewVisibility(R.id.kak_bar_btn_open, android.view.View.VISIBLE);
    } else if (state.complete || !state.active) {
      views.setViewVisibility(R.id.kak_bar_btn_rep, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_set, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_skip, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_open, android.view.View.VISIBLE);
    } else {
      views.setViewVisibility(R.id.kak_bar_btn_rep, android.view.View.VISIBLE);
      views.setViewVisibility(R.id.kak_bar_btn_set, android.view.View.VISIBLE);
      views.setViewVisibility(R.id.kak_bar_btn_skip, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_open, android.view.View.VISIBLE);
    }

    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    Intent tick = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_TICK_REP);
    Intent complete = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET);
    Intent skip = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_SKIP_REST);
    Intent open = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_OPEN);
    views.setOnClickPendingIntent(R.id.kak_bar_btn_rep, PendingIntent.getBroadcast(context, 1101, tick, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_set, PendingIntent.getBroadcast(context, 1102, complete, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_skip, PendingIntent.getBroadcast(context, 1103, skip, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_open, PendingIntent.getBroadcast(context, 1104, open, flags));
    views.setOnClickPendingIntent(R.id.kak_widget_root, PendingIntent.getBroadcast(context, 1105, open, flags));
    return views;
  }
}
`,
    "KakWorkoutOverlayService.java": `package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.widget.RemoteViews;
import ${packageName}.R;

/**
 * Foreground service that drives lock screen + notification shade with the same
 * interactive RemoteViews layout as the home-screen widget (+ Rep, Done, Skip rest).
 */
public class KakWorkoutOverlayService extends Service {
  private static final String CHANNEL_ID = "kak_workout_live_v10";
  private static final int NOTIFICATION_ID = 9001;
  private static volatile boolean running = false;

  static boolean isRunning() { return running; }

  private final Handler handler = new Handler(Looper.getMainLooper());

  /** Ticks every second while a workout is active to refresh elapsed time + rest countdown. */
  private final Runnable tickRunnable = new Runnable() {
    @Override public void run() {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(KakWorkoutOverlayService.this);
      if (!state.active) { stopSelf(); return; }
      postNotification(state);
      KakWorkoutWidgetProvider.updateAll(KakWorkoutOverlayService.this);
      handler.postDelayed(this, 1000L);
    }
  };

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override
  public void onCreate() {
    super.onCreate();
    running = true;
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : null;
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(this);

    // Android 8+: must call startForeground() within 5 s of startForegroundService().
    // Always do this BEFORE any early-exit paths to prevent ForegroundServiceDidNotStartInTimeException.
    Notification initialNotification = state.active ? buildNotification(state) : buildFallbackNotification(state);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, initialNotification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFICATION_ID, initialNotification);
    }

    if (KakWorkoutWidgetState.ACTION_STOP.equals(action)) {
      handler.removeCallbacks(tickRunnable);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE);
      } else {
        stopForeground(true);
      }
      stopSelf();
      return START_NOT_STICKY;
    }

    if (!state.active) {
      handler.removeCallbacks(tickRunnable);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE);
      } else {
        stopForeground(true);
      }
      stopSelf();
      return START_NOT_STICKY;
    }

    handler.removeCallbacks(tickRunnable);
    handler.post(tickRunnable);
    return START_STICKY;
  }

  private void postNotification(KakWorkoutWidgetState state) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(state));
  }

  private Notification buildNotification(KakWorkoutWidgetState state) {
    try {
      return buildNotificationInner(state);
    } catch (Throwable error) {
      android.util.Log.e("KakWorkoutOverlay", "buildNotification failed", error);
      return buildFallbackNotification(state);
    }
  }

  private Notification buildFallbackNotification(KakWorkoutWidgetState state) {
    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(this, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(this);
    }
    builder
      .setContentTitle(state.widgetTitleLine())
      .setContentText(state.barSubtitle())
      .setSmallIcon(R.drawable.kak_notif_icon)
      .setOngoing(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC);
    return builder.build();
  }

  private Notification buildNotificationInner(KakWorkoutWidgetState state) {
    int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent piOpen = null;
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
          | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      piOpen = PendingIntent.getActivity(this, 0, launch, f);
    }

    PendingIntent piRep  = PendingIntent.getBroadcast(this, 2001,
      new Intent(this, KakWorkoutWidgetActionReceiver.class)
        .setAction(KakWorkoutWidgetState.ACTION_TICK_REP).setPackage(getPackageName()), f);
    PendingIntent piDone = PendingIntent.getBroadcast(this, 2002,
      new Intent(this, KakWorkoutWidgetActionReceiver.class)
        .setAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET).setPackage(getPackageName()), f);
    PendingIntent piSkip = PendingIntent.getBroadcast(this, 2003,
      new Intent(this, KakWorkoutWidgetActionReceiver.class)
        .setAction(KakWorkoutWidgetState.ACTION_SKIP_REST).setPackage(getPackageName()), f);

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(this, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(this);
    }

    builder
      .setContentTitle(state.widgetTitleLine())
      .setContentText(state.barSubtitle())
      .setSubText(state.active ? state.progressLabel : "")
      .setSmallIcon(R.drawable.kak_notif_icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setColor(Color.parseColor("#0A84FF"));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      builder.setCategory(Notification.CATEGORY_WORKOUT);
    }

    if (piOpen != null) builder.setContentIntent(piOpen);

    // Same interactive layout as the home widget — shown on lock screen + collapsed shade.
    RemoteViews compact = KakWorkoutWidgetProvider.buildRemoteViews(this);
    builder.setCustomContentView(compact);
    builder.setCustomBigContentView(buildBigView(state, piRep, piDone, piSkip, piOpen));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setStyle(new Notification.DecoratedCustomViewStyle());
    }

    // Fallback action buttons for launchers that show them below the custom view.
    if (state.isResting()) {
      builder.addAction(new Notification.Action.Builder(
        android.R.drawable.ic_media_ff, "Skip rest", piSkip).build());
    } else if (!state.complete && state.active) {
      builder.addAction(new Notification.Action.Builder(
        android.R.drawable.ic_input_add, "+ Rep", piRep).build());
      builder.addAction(new Notification.Action.Builder(
        android.R.drawable.ic_menu_save, "Done set", piDone).build());
    }
    if (piOpen != null) {
      builder.addAction(new Notification.Action.Builder(
        android.R.drawable.ic_menu_view, "Open", piOpen).build());
    }

    return builder.build();
  }

  /**
   * Expanded notification shade card with extra detail (header, rest timer text).
   */
  private RemoteViews buildBigView(
      KakWorkoutWidgetState state,
      PendingIntent piRep, PendingIntent piDone, PendingIntent piSkip,
      PendingIntent piOpen) {

    RemoteViews views = new RemoteViews(getPackageName(), R.layout.kak_workout_notification);

    views.setTextViewText(R.id.kak_notif_workout_header, state.workoutHeaderLabel());
    views.setTextViewText(R.id.kak_notif_exercise, state.exerciseLabel());
    views.setTextViewText(R.id.kak_notif_set_detail, state.setDetailLine() + " • " + state.repProgressLabel());
    String nextLabel = state.nextExerciseLabel();
    if (nextLabel.length() > 0 && state.active && !state.complete) {
      views.setViewVisibility(R.id.kak_notif_next, android.view.View.VISIBLE);
      views.setTextViewText(R.id.kak_notif_next, nextLabel);
    } else {
      views.setViewVisibility(R.id.kak_notif_next, android.view.View.GONE);
    }
    views.setTextViewText(R.id.kak_notif_rep_tick, state.repTickLabel());
    if (state.active && !state.complete && !state.isResting() && state.repTickLabel().length() > 0) {
      views.setViewVisibility(R.id.kak_notif_rep_tick, android.view.View.VISIBLE);
    } else {
      views.setViewVisibility(R.id.kak_notif_rep_tick, android.view.View.GONE);
    }

    // Rest timer section
    if (state.isResting()) {
      views.setViewVisibility(R.id.kak_notif_rest_section, android.view.View.VISIBLE);
      views.setTextViewText(R.id.kak_notif_rest_time, state.restTimerLabel());
    } else {
      views.setViewVisibility(R.id.kak_notif_rest_section, android.view.View.GONE);
    }

    // Show the correct button row
    if (state.isResting()) {
      views.setViewVisibility(R.id.kak_notif_work_row, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_notif_rest_row, android.view.View.VISIBLE);
      views.setOnClickPendingIntent(R.id.kak_notif_skip, piSkip);
      if (piOpen != null) views.setOnClickPendingIntent(R.id.kak_notif_open_rest, piOpen);
    } else {
      views.setViewVisibility(R.id.kak_notif_work_row, android.view.View.VISIBLE);
      views.setViewVisibility(R.id.kak_notif_rest_row, android.view.View.GONE);
      if (!state.complete && state.nextSetId != null && !state.nextSetId.isEmpty()) {
        views.setOnClickPendingIntent(R.id.kak_notif_tick_rep, piRep);
        views.setOnClickPendingIntent(R.id.kak_notif_complete, piDone);
      }
      if (piOpen != null) views.setOnClickPendingIntent(R.id.kak_notif_open, piOpen);
    }

    return views;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
        CHANNEL_ID, "Active workout", NotificationManager.IMPORTANCE_DEFAULT);
      ch.setDescription("Workout controls on lock screen, notification shade, and home widget");
      ch.setShowBadge(false);
      ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      ch.enableVibration(false);
      ch.setSound(null, null);
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.createNotificationChannel(ch);
    }
  }

  @Override
  public void onDestroy() {
    running = false;
    handler.removeCallbacks(tickRunnable);
    super.onDestroy();
  }
}
`,
    "KakWorkoutFloatingOverlayService.java": `package ${pkg};

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;

/**
 * Legacy overlay service — disabled. Workout controls use home widget + notification only.
 * Kept registered so older app versions can hide any existing overlay window safely.
 */
public class KakWorkoutFloatingOverlayService extends Service {
  @Override public IBinder onBind(Intent intent) { return null; }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    stopSelf();
    return START_NOT_STICKY;
  }

  static boolean canDraw(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      return Settings.canDrawOverlays(context);
    }
    return true;
  }

  static void show(Context context) { /* disabled */ }
  static void hide(Context context) { /* disabled */ }
  static void update(Context context) { /* disabled */ }
}
`,
  };
}

function writeNativeFiles(projectRoot, packageName) {
  const srcDir = path.join(projectRoot, "android/app/src/main/java", ...packageName.split("."), "widget");
  const sources = javaSources(packageName);
  for (const [file, contents] of Object.entries(sources)) write(path.join(srcDir, file), contents);

  const res = path.join(projectRoot, "android/app/src/main/res");

  // Notification small icon — white silhouette barbell on transparent bg
  write(path.join(res, "drawable/kak_notif_icon.xml"), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <!-- Barbell / dumbbell silhouette -->
  <path
      android:fillColor="#FFFFFF"
      android:pathData="M20.57,14.86L22,13.43 20.57,12 17,15.57 8.43,7 12,3.43 10.57,2 9.14,3.43 7.71,2 5.57,4.14 4.14,2.71 2.71,4.14 4.14,5.57 2,7.71 3.43,9.14 2,10.57 3.43,12 7,8.43 15.57,17 12,20.57 13.43,22 14.86,20.57 16.29,22 18.43,19.86 19.86,21.29 21.29,19.86 19.86,18.43 22,16.29z"/>
</vector>
`);

  write(path.join(res, "xml/kak_workout_widget_info.xml"), `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:minResizeWidth="180dp"
    android:minResizeHeight="84dp"
    android:maxResizeWidth="500dp"
    android:maxResizeHeight="250dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/kak_workout_widget"
    android:previewLayout="@layout/kak_workout_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/app_name" />
`);

  write(path.join(res, "layout/kak_workout_widget_initial.xml"), `<?xml version="1.0" encoding="utf-8"?>
<!-- Minimal layout — must inflate on every launcher before onUpdate runs. -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#FF1A1D23"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="12dp">
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Kak Fit"
        android:textColor="#FFFFFFFF"
        android:textSize="14sp"
        android:textStyle="bold" />
</LinearLayout>
`);

  write(path.join(res, "layout/kak_workout_widget.xml"), `<?xml version="1.0" encoding="utf-8"?>
<!-- RemoteViews-safe: TextView + LinearLayout only, solid hex backgrounds (no drawables). -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/kak_widget_root"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:paddingLeft="12dp"
    android:paddingRight="12dp"
    android:paddingTop="10dp"
    android:paddingBottom="10dp"
    android:background="#FF1A1D23">

    <TextView
        android:id="@+id/kak_widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:text="Kak Fit"
        android:textColor="#FFFFFFFF"
        android:textSize="14sp"
        android:textStyle="bold" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:gravity="center_vertical"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_widget_detail"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Start a workout"
            android:textColor="#FFCBD5E1"
            android:textSize="11sp" />
        <TextView
            android:id="@+id/kak_widget_elapsed"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginLeft="6dp"
            android:textColor="#FF93C5FD"
            android:textSize="10sp"
            android:textStyle="bold"
            android:visibility="gone" />
        <TextView
            android:id="@+id/kak_widget_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginLeft="6dp"
            android:paddingLeft="7dp"
            android:paddingRight="7dp"
            android:paddingTop="3dp"
            android:paddingBottom="3dp"
            android:background="#FF1E3A8A"
            android:text="Ready"
            android:textColor="#FF93C5FD"
            android:textSize="10sp"
            android:textStyle="bold" />
    </LinearLayout>

    <TextView
        android:id="@+id/kak_widget_next"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textColor="#FF64748B"
        android:textSize="10sp"
        android:visibility="gone" />

    <TextView
        android:id="@+id/kak_widget_rep_tick"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:textColor="#FF10B981"
        android:textSize="11sp"
        android:textStyle="bold"
        android:visibility="gone" />

    <TextView
        android:id="@+id/kak_widget_rest_time"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:gravity="center"
        android:paddingTop="6dp"
        android:paddingBottom="6dp"
        android:background="#FF042F2E"
        android:textColor="#FF10B981"
        android:textSize="16sp"
        android:textStyle="bold"
        android:visibility="gone" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="32dp"
        android:layout_marginTop="6dp"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_bar_btn_rep"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:gravity="center"
            android:background="#FF0A84FF"
            android:text="+ Rep"
            android:textColor="#FFFFFFFF"
            android:textSize="11sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_bar_btn_set"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="5dp"
            android:gravity="center"
            android:background="#FF059669"
            android:text="Done"
            android:textColor="#FFFFFFFF"
            android:textSize="11sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_bar_btn_skip"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="5dp"
            android:gravity="center"
            android:background="#FFD97706"
            android:text="Skip"
            android:textColor="#FFFFFFFF"
            android:textSize="11sp"
            android:textStyle="bold"
            android:visibility="gone" />
        <TextView
            android:id="@+id/kak_bar_btn_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="5dp"
            android:gravity="center"
            android:background="#FF2A2A2E"
            android:text="Open"
            android:textColor="#FFF8FAFC"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>
</LinearLayout>
`);

  write(path.join(res, "layout/kak_workout_widget_fallback.xml"), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/kak_fallback_root"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="#1E293B">
    <TextView
        android:id="@+id/kak_fallback_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center"
        android:text="Kak Fit"
        android:textColor="#FFFFFF"
        android:textSize="14sp"
        android:textStyle="bold" />
</LinearLayout>
`);

  write(path.join(res, "drawable/kak_widget_set_button.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="14dp" />
    <solid android:color="#059669" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_skip_button.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="14dp" />
    <solid android:color="#D97706" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_bg.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="22dp" />
    <solid android:color="#E61A1D23" />
    <stroke android:width="1dp" android:color="#334155" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_progress_bg.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="999dp" />
    <solid android:color="#1E3A8A" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_primary_button.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="14dp" />
    <solid android:color="#0A84FF" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_secondary_button.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="14dp" />
    <solid android:color="#2A2A2E" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_drag_handle.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="999dp" />
    <solid android:color="#64748B" />
</shape>
`);

  // Drawables used by kak_workout_notification.xml
  write(path.join(res, "drawable/kak_notif_bg.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="0dp" />
    <solid android:color="#0F172A" />
</shape>
`);
  write(path.join(res, "drawable/kak_notif_open_btn.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="12dp" />
    <solid android:color="#1E293B" />
    <stroke android:width="1dp" android:color="#2D4A6B" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_rest_bg.xml"), `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <corners android:radius="12dp" />
    <solid android:color="#042F2E" />
    <stroke android:width="1dp" android:color="#065F46" />
</shape>
`);
  write(path.join(res, "drawable/kak_widget_rest_progress.xml"), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@android:id/background">
        <shape>
            <corners android:radius="4dp" />
            <solid android:color="#1E293B" />
        </shape>
    </item>
    <item android:id="@android:id/progress">
        <clip>
            <shape>
                <corners android:radius="4dp" />
                <solid android:color="#10B981" />
            </shape>
        </clip>
    </item>
</layer-list>
`);

  // Floating overlay layout (Spotify-style draggable pill)
  write(path.join(res, "layout/kak_workout_overlay.xml"), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="310dp"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:paddingLeft="14dp"
    android:paddingRight="14dp"
    android:paddingTop="12dp"
    android:paddingBottom="12dp"
    android:background="@drawable/kak_widget_bg"
    android:elevation="8dp">

    <LinearLayout
        android:id="@+id/kak_overlay_drag_handle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/kak_overlay_title"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:textColor="#F1F5F9"
                android:textSize="15sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/kak_overlay_subtitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="3dp"
                android:maxLines="1"
                android:ellipsize="end"
                android:textColor="#94A3B8"
                android:textSize="12sp" />
        </LinearLayout>

        <TextView
            android:id="@+id/kak_overlay_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginLeft="10dp"
            android:paddingLeft="9dp"
            android:paddingRight="9dp"
            android:paddingTop="3dp"
            android:paddingBottom="3dp"
            android:background="@drawable/kak_widget_progress_bg"
            android:textColor="#60A5FA"
            android:textSize="10sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/kak_overlay_dismiss"
            android:layout_width="28dp"
            android:layout_height="28dp"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:text="✕"
            android:textColor="#94A3B8"
            android:textSize="14sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:id="@+id/kak_overlay_rest_row"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="9dp"
        android:orientation="vertical"
        android:background="@drawable/kak_widget_rest_bg"
        android:paddingLeft="10dp"
        android:paddingRight="10dp"
        android:paddingTop="8dp"
        android:paddingBottom="8dp"
        android:visibility="gone">

        <ProgressBar
            android:id="@+id/kak_overlay_rest_bar"
            style="?android:attr/progressBarStyleHorizontal"
            android:layout_width="match_parent"
            android:layout_height="4dp"
            android:progressDrawable="@drawable/kak_widget_rest_progress"
            android:max="100"
            android:progress="100" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="5dp"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="REST"
                android:textColor="#6EE7B7"
                android:textSize="9sp"
                android:textStyle="bold"
                android:letterSpacing="0.12" />

            <TextView
                android:id="@+id/kak_overlay_rest_timer"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#10B981"
                android:textSize="18sp"
                android:textStyle="bold"
                android:fontFamily="monospace" />
        </LinearLayout>
    </LinearLayout>

    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:layout_marginTop="10dp"
        android:layout_marginBottom="2dp"
        android:background="#1E293B" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="44dp"
        android:layout_marginTop="6dp"
        android:orientation="horizontal">

        <TextView
            android:id="@+id/kak_overlay_complete"
            android:layout_width="52dp"
            android:layout_height="match_parent"
            android:gravity="center"
            android:background="@drawable/kak_widget_primary_button"
            android:text="✓"
            android:textColor="#FFFFFF"
            android:textSize="20sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/kak_overlay_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_secondary_button"
            android:text="Open Workout  →"
            android:textColor="#CBD5E1"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

</LinearLayout>
`);

  // Notification shade big-content layout
  write(path.join(res, "layout/kak_workout_notification.xml"), `<?xml version="1.0" encoding="utf-8"?>
<!--
  Custom big content view shown expanded in the notification shade.
  Lock screen uses the same interactive layout as the home widget via setCustomContentView.
-->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:paddingLeft="16dp"
    android:paddingRight="16dp"
    android:paddingTop="12dp"
    android:paddingBottom="12dp"
    android:background="@drawable/kak_notif_bg">

    <TextView
        android:id="@+id/kak_notif_workout_header"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:textColor="#64748B"
        android:textSize="11sp"
        android:textStyle="bold"
        android:letterSpacing="0.04" />

    <TextView
        android:id="@+id/kak_notif_exercise"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="5dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textColor="#F1F5F9"
        android:textSize="19sp"
        android:textStyle="bold" />

    <TextView
        android:id="@+id/kak_notif_set_detail"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="3dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textColor="#94A3B8"
        android:textSize="12sp" />

    <TextView
        android:id="@+id/kak_notif_next"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="3dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textColor="#64748B"
        android:textSize="11sp"
        android:visibility="gone" />

    <TextView
        android:id="@+id/kak_notif_rep_tick"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:textColor="#10B981"
        android:textSize="12sp"
        android:textStyle="bold"
        android:visibility="gone" />

    <LinearLayout
        android:id="@+id/kak_notif_rest_section"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:orientation="vertical"
        android:background="@drawable/kak_widget_rest_bg"
        android:paddingLeft="12dp"
        android:paddingRight="12dp"
        android:paddingTop="8dp"
        android:paddingBottom="8dp"
        android:visibility="gone">

        <TextView
            android:id="@+id/kak_notif_rest_time"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:gravity="center"
            android:text="REST"
            android:textColor="#10B981"
            android:textSize="20sp"
            android:textStyle="bold" />
    </LinearLayout>

    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:layout_marginTop="10dp"
        android:layout_marginBottom="4dp"
        android:background="#1E293B" />

    <!-- Work mode buttons: + Rep  Done set  Open -->
    <LinearLayout
        android:id="@+id/kak_notif_work_row"
        android:layout_width="match_parent"
        android:layout_height="40dp"
        android:layout_marginTop="6dp"
        android:orientation="horizontal"
        android:visibility="visible">

        <TextView
            android:id="@+id/kak_notif_tick_rep"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:gravity="center"
            android:background="@drawable/kak_widget_primary_button"
            android:text="+ Rep"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/kak_notif_complete"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_set_button"
            android:text="Done"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/kak_notif_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_notif_open_btn"
            android:text="Open"
            android:textColor="#CBD5E1"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

    <!-- Rest mode buttons: Skip rest  Open -->
    <LinearLayout
        android:id="@+id/kak_notif_rest_row"
        android:layout_width="match_parent"
        android:layout_height="40dp"
        android:layout_marginTop="6dp"
        android:orientation="horizontal"
        android:visibility="gone">

        <TextView
            android:id="@+id/kak_notif_skip"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:gravity="center"
            android:background="@drawable/kak_widget_skip_button"
            android:text="Skip rest"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/kak_notif_open_rest"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_notif_open_btn"
            android:text="Open"
            android:textColor="#CBD5E1"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

</LinearLayout>
`);
}

function withWorkoutWidget(config) {
  const packageName = config.android?.package;

  config = withAndroidManifest(config, (mod) => {
    addWorkoutManifestEntries(mod.modResults);
    return mod;
  });

  return withDangerousMod(config, ["android", (mod) => {
    if (!packageName) throw new Error("Workout widget requires expo.android.package");
    writeNativeFiles(mod.modRequest.projectRoot, packageName);
    patchMainApplication(mod.modRequest.projectRoot, packageName);
    return mod;
  }]);
}

module.exports = createRunOncePlugin(withWorkoutWidget, "with-workout-widget", WIDGET_VERSION);
