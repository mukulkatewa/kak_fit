const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_VERSION = "1.5.0";

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
  addManifestChildOnce(app, "service", {
    "android:name": ".widget.KakWorkoutOverlayService",
    "android:exported": "false",
    "android:foregroundServiceType": "specialUse",
  }, "android:name");

  const permissions = ensureArray(androidManifest.manifest["uses-permission"]);
  const requiredPerms = [
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.POST_NOTIFICATIONS",
  ];
  for (const perm of requiredPerms) {
    if (!permissions.some((p) => p.$?.["android:name"] === perm)) {
      permissions.push({ $: { "android:name": perm } });
    }
  }
  androidManifest.manifest["uses-permission"] = permissions;
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

  static int getOverlayX(Context context, int fallback) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("overlayX", fallback);
  }

  static int getOverlayY(Context context, int fallback) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("overlayY", fallback);
  }

  static void saveOverlayPosition(Context context, int x, int y) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("overlayX", x).putInt("overlayY", y).apply();
  }

  boolean isResting() {
    return restEndsAtMs > System.currentTimeMillis();
  }

  int restSecondsLeft() {
    if (!isResting()) return 0;
    return Math.max(1, (int) Math.ceil((restEndsAtMs - System.currentTimeMillis()) / 1000.0));
  }

  String title() {
    if (!active) return "No active workout";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    return workoutName + " • " + elapsedLabel;
  }

  String exerciseLine() {
    if (!active) return "Start a workout to use quick controls";
    if (complete) return "All sets complete";
    if (isResting()) return shortExerciseName;
    return shortExerciseName;
  }

  String detailLine() {
    if (!active) return "";
    if (complete) return progressLabel;
    if (isResting()) return "Get ready for the next set";
    if (setLabel != null && setLabel.length() > 0) return setLabel;
    return "Set " + nextSetNumber + " • " + nextSetReps + " reps";
  }

  String repProgressLabel() {
    if (!active) return "";
    if (isResting()) return "Rest before next set";
    if (complete) return "All sets done";
    return repsCompleted + "/" + nextSetReps + " reps";
  }

  String notificationBody() {
    if (!active) return "Start a workout";
    if (isResting()) return shortExerciseName + " • up next";
    if (complete) return progressLabel;
    return setLabel + " • " + repProgressLabel();
  }

  String barTitle() {
    if (!active) return "Kak Fit";
    if (isResting()) return "Rest • " + formatRest(restSecondsLeft());
    return shortExerciseName;
  }

  String barSubtitle() {
    if (!active) return "Start a workout";
    if (complete) return "All sets complete";
    if (isResting()) return "Up next • " + shortExerciseName;
    if (setLabel != null && setLabel.length() > 0) return setLabel + " • " + repProgressLabel();
    return "Set " + nextSetNumber + " • " + repProgressLabel();
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

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
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
  public String getName() {
    return "KakWorkoutWidget";
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(double count) {}

  @ReactMethod
  public void update(ReadableMap summary) {
    Context context = getReactApplicationContext();
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    String previousSetId = prefs.getString("nextSetId", "");
    String nextSetId = "";
    int nextSetNumber = 0;
    int nextSetReps = 1;
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
      editor.putInt("repsCompleted", 0).putLong("restEndsAtMs", 0L);
    }
    editor.apply();

    KakWorkoutWidgetProvider.updateAll(context);
    if (prefs.getBoolean("overlayEnabled", false)) {
      refreshOverlay(context);
    }
  }

  @ReactMethod
  public void tickRep() {
    Context context = getReactApplicationContext();
    Intent intent = new Intent(context, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_TICK_REP)
      .setPackage(context.getPackageName());
    context.sendBroadcast(intent);
  }

  @ReactMethod
  public void skipRest() {
    Context context = getReactApplicationContext();
    Intent intent = new Intent(context, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_SKIP_REST)
      .setPackage(context.getPackageName());
    context.sendBroadcast(intent);
  }

  @ReactMethod
  public void startRestTimer(int seconds) {
    if (seconds <= 0) return;
    Context context = getReactApplicationContext();
    long endsAt = System.currentTimeMillis() + seconds * 1000L;
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong("restEndsAtMs", endsAt)
      .putInt("repsCompleted", 0)
      .apply();
    refreshOverlay(context);
  }

  static void refreshOverlay(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("overlayEnabled", false) || !prefs.getBoolean("active", false)) {
      return;
    }
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
      .putBoolean("overlayEnabled", false)
      .remove("nextSetId")
      .apply();
    KakWorkoutWidgetProvider.updateAll(context);
    try {
      context.stopService(new Intent(context, KakWorkoutOverlayService.class));
    } catch (Exception ignored) {}
  }

  @ReactMethod
  public void canDrawOverlays(Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve(true);
      return;
    }
    promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
  }

  @ReactMethod
  public void requestOverlayPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
    Activity activity = getCurrentActivity();
    if (activity == null) return;
    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + activity.getPackageName()));
    activity.startActivity(intent);
  }

  @ReactMethod
  public void refreshLockscreen() {
    refreshOverlay(getReactApplicationContext());
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
  public void startOverlay() {
    Context context = getReactApplicationContext();
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("overlayEnabled", true)
      .apply();
    refreshOverlay(context);
  }

  @ReactMethod
  public void stopOverlay() {
    Context context = getReactApplicationContext();
    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("overlayEnabled", false)
      .apply();
    try {
      context.stopService(new Intent(context, KakWorkoutOverlayService.class));
    } catch (Exception ignored) {}
  }

  private static void startOverlayServiceSafely(Context context) {
    refreshOverlay(context);
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
      KakWorkoutWidgetModule.refreshOverlay(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_COMPLETE_SET.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (state.active && !state.isResting() && state.nextSetId != null && state.nextSetId.length() > 0) {
        String setId = KakWorkoutWidgetState.completeCurrentSetLocally(context, state.nextSetId);
        if (setId != null) KakWorkoutWidgetModule.emitCompleteSet(context, setId);
      }
      KakWorkoutWidgetModule.refreshOverlay(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
    if (KakWorkoutWidgetState.ACTION_SKIP_REST.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (!state.active || !state.isResting()) return;
      KakWorkoutWidgetState.skipRest(context);
      KakWorkoutWidgetModule.emitSkipRest(context);
      KakWorkoutWidgetModule.refreshOverlay(context);
      KakWorkoutWidgetProvider.updateAll(context);
      return;
    }
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
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.util.DisplayMetrics;
import android.widget.RemoteViews;
import android.widget.TextView;
import ${packageName}.R;

public class KakWorkoutOverlayService extends Service {
  private static final String CHANNEL_ID = "kak_workout_live_v5";
  private static final int NOTIFICATION_ID = 9001;

  private WindowManager windowManager;
  private View overlay;
  private WindowManager.LayoutParams params;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable tickRunnable = new Runnable() {
    @Override
    public void run() {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(KakWorkoutOverlayService.this);
      if (!state.active) {
        stopSelf();
        return;
      }
      refreshUi(state);
      if (state.isResting()) {
        handler.postDelayed(this, 1000L);
      }
    }
  };

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(this);
    if (!state.active) {
      stopSelf();
      return START_NOT_STICKY;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForeground(NOTIFICATION_ID, buildNotification(state));
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
      showOrUpdate(state);
    }
    handler.removeCallbacks(tickRunnable);
    if (state.isResting()) {
      handler.post(tickRunnable);
    } else {
      refreshUi(state);
    }
    return START_STICKY;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID, "Active workout", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Workout bar on lock screen and notifications");
      channel.setShowBadge(false);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      channel.enableVibration(false);
      channel.setSound(null, null);
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }

  private Notification buildNotification(KakWorkoutWidgetState state) {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pendingLaunch = null;
    if (launch != null) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      pendingLaunch = PendingIntent.getActivity(this, 0, launch,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    RemoteViews bar = buildBarViews(state);

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder = new Notification.Builder(this, CHANNEL_ID);
    } else {
      builder = new Notification.Builder(this);
    }

    builder.setContentTitle(state.barTitle())
      .setContentText(state.barSubtitle())
      .setSubText(state.progressLabel)
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_WORKOUT)
      .setColor(Color.parseColor("#0A84FF"));

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setCustomContentView(bar);
      builder.setCustomBigContentView(bar);
      builder.setStyle(new Notification.DecoratedCustomViewStyle());
    }

    if (pendingLaunch != null) builder.setContentIntent(pendingLaunch);
    return builder.build();
  }

  private RemoteViews buildBarViews(KakWorkoutWidgetState state) {
    RemoteViews views = new RemoteViews(getPackageName(), R.layout.kak_workout_bar);
    bindBarContent(views, state);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    Intent tick = new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_TICK_REP).setPackage(getPackageName());
    Intent complete = new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET).setPackage(getPackageName());
    Intent skip = new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_SKIP_REST).setPackage(getPackageName());
    Intent open = new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(KakWorkoutWidgetState.ACTION_OPEN).setPackage(getPackageName());
    views.setOnClickPendingIntent(R.id.kak_bar_btn_rep, PendingIntent.getBroadcast(this, 1201, tick, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_set, PendingIntent.getBroadcast(this, 1202, complete, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_skip, PendingIntent.getBroadcast(this, 1203, skip, flags));
    views.setOnClickPendingIntent(R.id.kak_bar_btn_open, PendingIntent.getBroadcast(this, 1204, open, flags));
    return views;
  }

  private void bindBarContent(RemoteViews views, KakWorkoutWidgetState state) {
    views.setTextViewText(R.id.kak_bar_title, state.barTitle());
    views.setTextViewText(R.id.kak_bar_subtitle, state.barSubtitle());
    views.setTextViewText(R.id.kak_bar_progress, state.progressLabel);
    if (state.isResting()) {
      views.setViewVisibility(R.id.kak_bar_btn_rep, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_set, android.view.View.GONE);
      views.setViewVisibility(R.id.kak_bar_btn_skip, android.view.View.VISIBLE);
      views.setViewVisibility(R.id.kak_bar_btn_open, android.view.View.VISIBLE);
    } else if (state.complete) {
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
  }

  private void showOrUpdate(KakWorkoutWidgetState state) {
    if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    if (overlay == null) {
      overlay = LayoutInflater.from(this).inflate(R.layout.kak_workout_bar, null);
      int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
      int overlayWidth = WindowManager.LayoutParams.MATCH_PARENT;
      params = new WindowManager.LayoutParams(
        overlayWidth,
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
          | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
          | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
        PixelFormat.TRANSLUCENT
      );
      params.gravity = Gravity.TOP | Gravity.START;
      DisplayMetrics metrics = getResources().getDisplayMetrics();
      int defaultX = dp(10);
      int defaultY = metrics.heightPixels - dp(160);
      params.x = KakWorkoutWidgetState.getOverlayX(this, defaultX);
      params.y = KakWorkoutWidgetState.getOverlayY(this, defaultY);
      wireOverlayButtons();
      installDragHandle();
      windowManager.addView(overlay, params);
    }
    bindOverlay(state);
  }

  private void installDragHandle() {
    View handle = overlay.findViewById(R.id.kak_bar_drag_handle);
    View header = overlay.findViewById(R.id.kak_bar_header);
    View.OnTouchListener dragListener = new View.OnTouchListener() {
      private int initialX;
      private int initialY;
      private float initialTouchX;
      private float initialTouchY;

      @Override
      public boolean onTouch(View view, MotionEvent event) {
        switch (event.getAction()) {
          case MotionEvent.ACTION_DOWN:
            initialX = params.x;
            initialY = params.y;
            initialTouchX = event.getRawX();
            initialTouchY = event.getRawY();
            return true;
          case MotionEvent.ACTION_MOVE:
            params.x = initialX + Math.round(event.getRawX() - initialTouchX);
            params.y = initialY + Math.round(event.getRawY() - initialTouchY);
            windowManager.updateViewLayout(overlay, params);
            return true;
          case MotionEvent.ACTION_UP:
          case MotionEvent.ACTION_CANCEL:
            KakWorkoutWidgetState.saveOverlayPosition(KakWorkoutOverlayService.this, params.x, params.y);
            return true;
        }
        return false;
      }
    };
    handle.setOnTouchListener(dragListener);
    header.setOnTouchListener(dragListener);
  }

  private void wireOverlayButtons() {
    overlay.findViewById(R.id.kak_bar_btn_rep).setOnClickListener((v) -> sendAction(KakWorkoutWidgetState.ACTION_TICK_REP));
    overlay.findViewById(R.id.kak_bar_btn_set).setOnClickListener((v) -> sendAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET));
    overlay.findViewById(R.id.kak_bar_btn_skip).setOnClickListener((v) -> sendAction(KakWorkoutWidgetState.ACTION_SKIP_REST));
    overlay.findViewById(R.id.kak_bar_btn_open).setOnClickListener((v) -> {
      Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(launch);
      }
    });
  }

  private void sendAction(String action) {
    Intent intent = new Intent(this, KakWorkoutWidgetActionReceiver.class)
      .setAction(action)
      .setPackage(getPackageName());
    sendBroadcast(intent);
  }

  private void bindOverlay(KakWorkoutWidgetState state) {
    ((TextView) overlay.findViewById(R.id.kak_bar_title)).setText(state.barTitle());
    ((TextView) overlay.findViewById(R.id.kak_bar_subtitle)).setText(state.barSubtitle());
    ((TextView) overlay.findViewById(R.id.kak_bar_progress)).setText(state.progressLabel);

    View btnRep = overlay.findViewById(R.id.kak_bar_btn_rep);
    View btnSet = overlay.findViewById(R.id.kak_bar_btn_set);
    View btnSkip = overlay.findViewById(R.id.kak_bar_btn_skip);
    View btnOpen = overlay.findViewById(R.id.kak_bar_btn_open);

    if (state.isResting()) {
      btnRep.setVisibility(View.GONE);
      btnSet.setVisibility(View.GONE);
      btnSkip.setVisibility(View.VISIBLE);
      btnOpen.setVisibility(View.VISIBLE);
    } else if (state.complete) {
      btnRep.setVisibility(View.GONE);
      btnSet.setVisibility(View.GONE);
      btnSkip.setVisibility(View.GONE);
      btnOpen.setVisibility(View.VISIBLE);
    } else {
      btnRep.setVisibility(View.VISIBLE);
      btnSet.setVisibility(View.VISIBLE);
      btnSkip.setVisibility(View.GONE);
      btnOpen.setVisibility(View.VISIBLE);
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(state));
    }
  }

  private void refreshUi(KakWorkoutWidgetState state) {
    if (overlay != null) {
      bindOverlay(state);
      return;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(state));
    }
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(tickRunnable);
    if (windowManager != null && overlay != null) {
      windowManager.removeView(overlay);
      overlay = null;
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
  write(path.join(res, "layout/kak_workout_bar.xml"), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/kak_bar_root"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginHorizontal="10dp"
    android:layout_marginBottom="6dp"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/kak_widget_bg"
    android:elevation="12dp">

    <View
        android:id="@+id/kak_bar_drag_handle"
        android:layout_width="52dp"
        android:layout_height="5dp"
        android:layout_gravity="center_horizontal"
        android:layout_marginBottom="8dp"
        android:background="@drawable/kak_widget_drag_handle" />

    <LinearLayout
        android:id="@+id/kak_bar_header"
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
                android:id="@+id/kak_bar_title"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:textColor="#FFFFFF"
                android:textSize="16sp"
                android:textStyle="bold" />
            <TextView
                android:id="@+id/kak_bar_subtitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="2dp"
                android:maxLines="1"
                android:ellipsize="end"
                android:textColor="#CBD5E1"
                android:textSize="13sp" />
        </LinearLayout>
        <TextView
            android:id="@+id/kak_bar_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:paddingLeft="10dp"
            android:paddingRight="10dp"
            android:paddingTop="5dp"
            android:paddingBottom="5dp"
            android:background="@drawable/kak_widget_progress_bg"
            android:textColor="#93C5FD"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="40dp"
        android:layout_marginTop="10dp"
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
            android:textSize="13sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_bar_btn_set"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_set_button"
            android:text="Done set"
            android:textColor="#FFFFFF"
            android:textSize="13sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_bar_btn_skip"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_skip_button"
            android:text="Skip rest"
            android:textColor="#FFFFFF"
            android:textSize="13sp"
            android:textStyle="bold"
            android:visibility="gone" />
        <TextView
            android:id="@+id/kak_bar_btn_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="8dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_secondary_button"
            android:text="Open"
            android:textColor="#F8FAFC"
            android:textSize="13sp"
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
