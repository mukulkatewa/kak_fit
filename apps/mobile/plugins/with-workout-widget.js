const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_VERSION = "2.2.0";

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

  // mediaPlayback foreground service type — no SYSTEM_ALERT_WINDOW or specialUse needed
  addManifestChildOnce(app, "service", {
    "android:name": ".widget.KakWorkoutOverlayService",
    "android:exported": "false",
    "android:foregroundServiceType": "mediaPlayback",
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
  // Remove legacy SYSTEM_ALERT_WINDOW and FOREGROUND_SERVICE_SPECIAL_USE if present
  androidManifest.manifest["uses-permission"] = permissions.filter(
    (p) => p.$?.["android:name"] !== "android.permission.SYSTEM_ALERT_WINDOW" &&
            p.$?.["android:name"] !== "android.permission.FOREGROUND_SERVICE_SPECIAL_USE"
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

  final boolean active;
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

  private KakWorkoutWidgetState(SharedPreferences prefs) {
    active = prefs.getBoolean("active", false);
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
  }

  static KakWorkoutWidgetState read(Context context) {
    return new KakWorkoutWidgetState(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
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
        .putString("shortExerciseName", "Workout complete");
    } else {
      try {
        JSONObject next = remaining.getJSONObject(0);
        editor.putBoolean("complete", false)
          .putString("nextSetId", next.optString("setId", ""))
          .putInt("nextSetNumber", next.optInt("setNumber", 0))
          .putInt("nextSetReps", Math.max(1, next.optInt("reps", 1)))
          .putFloat("nextSetWeight", (float) next.optDouble("weight", 0))
          .putString("shortExerciseName", next.optString("shortExerciseName", "Active workout"))
          .putString("setLabel", next.optString("setLabel", ""));
      } catch (Exception ignored) {}
    }
    editor.apply();
    return completedSetId;
  }

  private static void appendPendingSync(SharedPreferences.Editor editor, SharedPreferences prefs, String setId) {
    if (setId == null || setId.length() == 0) return;
    String existing = prefs.getString("pendingSyncSetIds", "");
    if (existing.contains(setId)) return;
    editor.putString("pendingSyncSetIds", existing.length() == 0 ? setId : existing + "," + setId);
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
    return workoutName + " • " + elapsedLabel;
  }

  String barSubtitle() {
    if (!active) return "Start a workout";
    if (complete) return "All sets complete";
    if (isResting()) return "Up next • " + shortExerciseName;
    if (setLabel != null && setLabel.length() > 0) return setLabel + " • " + repProgressLabel();
    return "Set " + nextSetNumber + " • " + repProgressLabel();
  }

  String repProgressLabel() {
    if (!active) return "";
    if (isResting()) return "Rest before next set";
    if (complete) return "All sets done";
    return repsCompleted + "/" + nextSetReps + " reps";
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
}
`,
    "KakWorkoutWidgetModule.java": `package ${pkg};

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

  KakWorkoutWidgetModule(ReactApplicationContext context) {
    super(context);
    reactContext = context;
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

    if (summary.hasKey("remainingSets") && !summary.isNull("remainingSets")) {
      ReadableArray remaining = summary.getArray("remainingSets");
      org.json.JSONArray json = new org.json.JSONArray();
      if (remaining != null) {
        for (int i = 0; i < remaining.size(); i++) {
          ReadableMap item = remaining.getMap(i);
          if (item == null) continue;
          org.json.JSONObject obj = new org.json.JSONObject();
          try {
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
    KakWorkoutWidgetProvider.updateAll(context); // sync home-screen widget to rest mode
  }

  /** Start or refresh the foreground notification service. */
  static void refreshNotification(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("active", false)) return;
    try {
      Intent intent = new Intent(context, KakWorkoutOverlayService.class)
        .setAction(KakWorkoutWidgetState.ACTION_REFRESH);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent);
      } else {
        context.startService(intent);
      }
    } catch (Exception ignored) {}
  }

  @ReactMethod
  public void clear() {
    Context context = getReactApplicationContext();
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("active", false)
      .remove("nextSetId")
      .apply();
    KakWorkoutWidgetProvider.updateAll(context);
    try { context.stopService(new Intent(context, KakWorkoutOverlayService.class)); } catch (Exception ignored) {}
  }

  @ReactMethod
  public void refreshLockscreen() {
    refreshNotification(getReactApplicationContext());
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
      KakWorkoutWidgetModule.refreshNotification(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_COMPLETE_SET.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (state.active && !state.isResting() && state.nextSetId != null && state.nextSetId.length() > 0) {
        String setId = KakWorkoutWidgetState.completeCurrentSetLocally(context, state.nextSetId);
        if (setId != null) KakWorkoutWidgetModule.emitCompleteSet(context, setId);
      }
      KakWorkoutWidgetModule.refreshNotification(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_SKIP_REST.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (!state.active || !state.isResting()) return;
      KakWorkoutWidgetState.skipRest(context);
      KakWorkoutWidgetModule.emitSkipRest(context);
      KakWorkoutWidgetModule.refreshNotification(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    // ACTION_OPEN and fallback: launch the app
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
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
import android.widget.RemoteViews;
import ${packageName}.R;

public class KakWorkoutWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      appWidgetManager.updateAppWidget(appWidgetId, buildViews(context));
    }
  }

  static void updateAll(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, KakWorkoutWidgetProvider.class);
    int[] ids = manager.getAppWidgetIds(component);
    for (int id : ids) {
      manager.updateAppWidget(id, buildViews(context));
    }
  }

  private static RemoteViews buildViews(Context context) {
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kak_workout_widget);
    views.setTextViewText(R.id.kak_widget_title, state.barTitle());
    views.setTextViewText(R.id.kak_widget_detail, state.barSubtitle());
    views.setTextViewText(R.id.kak_widget_progress, state.active ? state.progressLabel : "Ready");
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
import android.graphics.Color;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import android.os.Looper;
import ${packageName}.R;

/**
 * Foreground service that owns the workout MediaStyle notification.
 * Replaces the old TYPE_APPLICATION_OVERLAY floating window approach.
 * MediaStyle gives automatic lockscreen controls + notification-shade controls.
 */
public class KakWorkoutOverlayService extends Service {
  private static final String CHANNEL_ID = "kak_workout_live_v6";
  private static final int NOTIFICATION_ID = 9001;

  private MediaSession mediaSession;
  private final Handler handler = new Handler(Looper.getMainLooper());

  /** Ticks every second during rest to update the countdown in the notification. */
  private final Runnable tickRunnable = new Runnable() {
    @Override public void run() {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(KakWorkoutOverlayService.this);
      if (!state.active) { stopSelf(); return; }
      postNotification(state);
      if (state.isResting()) {
        handler.postDelayed(this, 1000L);
      } else {
        // Rest just expired — push one final widget refresh so the home-screen buttons
        // switch back from "Skip rest" mode to "Done set / +Rep" mode immediately.
        KakWorkoutWidgetProvider.updateAll(KakWorkoutOverlayService.this);
      }
    }
  };

  @Override public IBinder onBind(Intent intent) { return null; }

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
    setupMediaSession();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(this);
    if (!state.active) { stopSelf(); return START_NOT_STICKY; }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, buildNotification(state),
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFICATION_ID, buildNotification(state));
    }
    handler.removeCallbacks(tickRunnable);
    if (state.isResting()) handler.post(tickRunnable);
    return START_STICKY;
  }

  private void setupMediaSession() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      mediaSession = new MediaSession(this, "KakFitWorkout");
      mediaSession.setFlags(
        MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
        MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
      );
      mediaSession.setCallback(new MediaSession.Callback() {
        // onPlay  → complete current set (the primary action)
        @Override public void onPlay()       { sendAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET); }
        // onRewind → tick a rep counter
        @Override public void onRewind()     { sendAction(KakWorkoutWidgetState.ACTION_TICK_REP); }
        // onSkipToNext → skip rest timer
        @Override public void onSkipToNext() { sendAction(KakWorkoutWidgetState.ACTION_SKIP_REST); }
      });
      mediaSession.setActive(true);
    }
  }

  private void updateMediaSession(KakWorkoutWidgetState state) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP || mediaSession == null) return;
    long actions = PlaybackState.ACTION_PLAY |
                   PlaybackState.ACTION_REWIND |
                   PlaybackState.ACTION_SKIP_TO_NEXT;
    int pbState = state.isResting() ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING;
    mediaSession.setPlaybackState(new PlaybackState.Builder()
      .setActions(actions)
      .setState(pbState, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
      .build());
    mediaSession.setMetadata(new MediaMetadata.Builder()
      .putString(MediaMetadata.METADATA_KEY_TITLE,  state.barTitle())
      .putString(MediaMetadata.METADATA_KEY_ARTIST, state.barSubtitle())
      .putString(MediaMetadata.METADATA_KEY_ALBUM,  state.progressLabel)
      .build());
  }

  private void postNotification(KakWorkoutWidgetState state) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(state));
    }
  }

  private Notification buildNotification(KakWorkoutWidgetState state) {
    updateMediaSession(state);

    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent piOpen = null;
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      piOpen = PendingIntent.getActivity(this, 0, launch,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
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
      .setContentTitle(state.barTitle())
      .setContentText(state.barSubtitle())
      .setSubText(state.progressLabel)
      .setSmallIcon(R.drawable.kak_notif_icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setColor(Color.parseColor("#0A84FF"));

    if (piOpen != null) builder.setContentIntent(piOpen);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
      if (state.isResting()) {
        builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_media_ff, "Skip rest", piSkip).build());
        if (piOpen != null) builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_menu_view, "Open", piOpen).build());
        builder.setStyle(new Notification.MediaStyle()
          .setMediaSession(mediaSession.getSessionToken())
          .setShowActionsInCompactView(0));
      } else if (state.complete || !state.active) {
        if (piOpen != null) builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_menu_view, "Open", piOpen).build());
        builder.setStyle(new Notification.MediaStyle()
          .setMediaSession(mediaSession.getSessionToken())
          .setShowActionsInCompactView(0));
      } else {
        builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_media_rew, "+ Rep", piRep).build());
        builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_media_play, "Done set", piDone).build());
        if (piOpen != null) builder.addAction(new Notification.Action.Builder(
          android.R.drawable.ic_menu_view, "Open", piOpen).build());
        builder.setStyle(new Notification.MediaStyle()
          .setMediaSession(mediaSession.getSessionToken())
          .setShowActionsInCompactView(0, 1, 2));
      }
    }
    return builder.build();
  }

  private void sendAction(String action) {
    sendBroadcast(new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(action)
      .setPackage(getPackageName()));
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
        CHANNEL_ID, "Active workout", NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("Workout controls on lock screen and notification shade");
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
    handler.removeCallbacks(tickRunnable);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && mediaSession != null) {
      mediaSession.setActive(false);
      mediaSession.release();
      mediaSession = null;
    }
    super.onDestroy();
  }
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
    android:minWidth="280dp"
    android:minHeight="130dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:minResizeWidth="220dp"
    android:minResizeHeight="110dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/kak_workout_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen|keyguard" />
`);

  write(path.join(res, "layout/kak_workout_widget.xml"), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/kak_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/kak_widget_bg">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">
            <TextView
                android:id="@+id/kak_widget_title"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:text="Exercise"
                android:textColor="#FFFFFF"
                android:textSize="15sp"
                android:textStyle="bold" />
            <TextView
                android:id="@+id/kak_widget_detail"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="2dp"
                android:maxLines="1"
                android:ellipsize="end"
                android:text="Set 1 • 0/8 reps"
                android:textColor="#CBD5E1"
                android:textSize="12sp" />
        </LinearLayout>
        <TextView
            android:id="@+id/kak_widget_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:paddingLeft="8dp"
            android:paddingRight="8dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:background="@drawable/kak_widget_progress_bg"
            android:text="0/0"
            android:textColor="#93C5FD"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="36dp"
        android:layout_marginTop="8dp"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_bar_btn_rep"
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
            android:id="@+id/kak_bar_btn_set"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="6dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_set_button"
            android:text="Done set"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_bar_btn_skip"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="6dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_skip_button"
            android:text="Skip rest"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold"
            android:visibility="gone" />
        <TextView
            android:id="@+id/kak_bar_btn_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="6dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_secondary_button"
            android:text="Open"
            android:textColor="#F8FAFC"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>
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
