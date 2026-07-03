const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_VERSION = "1.0.0";

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
  const provider = app.receiver.find((entry) => entry.$["android:name"] === ".widget.KakWorkoutWidgetProvider");
  provider["intent-filter"] = [{ action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] }];
  provider["meta-data"] = [{ $: { "android:name": "android.appwidget.provider", "android:resource": "@xml/kak_workout_widget_info" } }];

  addManifestChildOnce(app, "receiver", {
    "android:name": ".widget.KakWorkoutWidgetActionReceiver",
    "android:exported": "false",
  }, "android:name");
  addManifestChildOnce(app, "service", {
    "android:name": ".widget.KakWorkoutOverlayService",
    "android:exported": "false",
  }, "android:name");

  const permissions = ensureArray(androidManifest.manifest["uses-permission"]);
  if (!permissions.some((permission) => permission.$?.["android:name"] === "android.permission.SYSTEM_ALERT_WINDOW")) {
    permissions.push({ $: { "android:name": "android.permission.SYSTEM_ALERT_WINDOW" } });
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
    src = src.replace(/(val packages = PackageList\(this\)\.packages\n)/, `$1        packages.add(KakWorkoutWidgetPackage())\n`);
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

class KakWorkoutWidgetState {
  static final String PREFS = "kak_workout_widget";
  static final String ACTION_REFRESH = "${packageName}.widget.REFRESH";
  static final String ACTION_COMPLETE_SET = "${packageName}.widget.COMPLETE_SET";
  static final String ACTION_OPEN = "${packageName}.widget.OPEN";

  final boolean active;
  final String workoutName;
  final String elapsedLabel;
  final String progressLabel;
  final String currentExerciseName;
  final String nextSetId;
  final String nextExerciseName;
  final int nextSetNumber;
  final boolean complete;

  private KakWorkoutWidgetState(SharedPreferences prefs) {
    active = prefs.getBoolean("active", false);
    workoutName = prefs.getString("workoutName", "Workout");
    elapsedLabel = prefs.getString("elapsedLabel", "0s");
    progressLabel = prefs.getString("progressLabel", "0/0 sets");
    currentExerciseName = prefs.getString("currentExerciseName", "Active workout");
    nextSetId = prefs.getString("nextSetId", "");
    nextExerciseName = prefs.getString("nextExerciseName", "");
    nextSetNumber = prefs.getInt("nextSetNumber", 0);
    complete = prefs.getBoolean("complete", false);
  }

  static KakWorkoutWidgetState read(Context context) {
    return new KakWorkoutWidgetState(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
  }

  String title() {
    return active ? workoutName + " • " + elapsedLabel : "No active workout";
  }

  String subtitle() {
    if (!active) return "Start a workout to use quick controls";
    if (complete) return "All sets complete • " + progressLabel;
    if (nextExerciseName == null || nextExerciseName.length() == 0) return currentExerciseName + " • " + progressLabel;
    return "Next: " + nextExerciseName + " set " + nextSetNumber + " • " + progressLabel;
  }
}
`,
    "KakWorkoutWidgetModule.java": `package ${pkg};

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
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
    String nextSetId = "";
    String nextExerciseName = "";
    int nextSetNumber = 0;
    if (summary.hasKey("nextSet") && !summary.isNull("nextSet")) {
      ReadableMap next = summary.getMap("nextSet");
      nextSetId = next.hasKey("setId") && !next.isNull("setId") ? next.getString("setId") : "";
      nextExerciseName = next.hasKey("exerciseName") && !next.isNull("exerciseName") ? next.getString("exerciseName") : "";
      nextSetNumber = next.hasKey("setNumber") ? next.getInt("setNumber") : 0;
    }

    context.getSharedPreferences(KakWorkoutWidgetState.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("active", true)
      .putString("workoutName", summary.hasKey("workoutName") ? summary.getString("workoutName") : "Workout")
      .putString("elapsedLabel", summary.hasKey("elapsedLabel") ? summary.getString("elapsedLabel") : "0s")
      .putString("progressLabel", summary.hasKey("progressLabel") ? summary.getString("progressLabel") : "0/0 sets")
      .putString("currentExerciseName", summary.hasKey("currentExerciseName") ? summary.getString("currentExerciseName") : "Active workout")
      .putString("nextSetId", nextSetId)
      .putString("nextExerciseName", nextExerciseName)
      .putInt("nextSetNumber", nextSetNumber)
      .putBoolean("complete", summary.hasKey("isComplete") && summary.getBoolean("isComplete"))
      .apply();

    KakWorkoutWidgetProvider.updateAll(context);
    context.startService(new Intent(context, KakWorkoutOverlayService.class).setAction(KakWorkoutWidgetState.ACTION_REFRESH));
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
    context.stopService(new Intent(context, KakWorkoutOverlayService.class));
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
  public void startOverlay() {
    Context context = getReactApplicationContext();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) return;
    context.startService(new Intent(context, KakWorkoutOverlayService.class).setAction(KakWorkoutWidgetState.ACTION_REFRESH));
  }

  @ReactMethod
  public void stopOverlay() {
    Context context = getReactApplicationContext();
    context.stopService(new Intent(context, KakWorkoutOverlayService.class));
  }

  static void emitCompleteSet(Context context, String setId) {
    if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
      WritableMap payload = Arguments.createMap();
      payload.putString("setId", setId == null ? "" : setId);
      reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("KakWorkoutWidgetCompleteSet", payload);
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
    "KakWorkoutWidgetActionReceiver.java": `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class KakWorkoutWidgetActionReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent.getAction();
    if (KakWorkoutWidgetState.ACTION_COMPLETE_SET.equals(action)) {
      KakWorkoutWidgetState state = KakWorkoutWidgetState.read(context);
      if (state.active && state.nextSetId != null && state.nextSetId.length() > 0) {
        KakWorkoutWidgetModule.emitCompleteSet(context, state.nextSetId);
      }
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
    views.setTextViewText(R.id.kak_widget_title, state.title());
    views.setTextViewText(R.id.kak_widget_subtitle, state.subtitle());
    views.setTextViewText(R.id.kak_widget_progress, state.active ? state.progressLabel : "Ready");
    views.setTextViewText(R.id.kak_widget_complete, state.complete ? "Done" : "Complete set");
    views.setBoolean(R.id.kak_widget_complete, "setEnabled", state.active && !state.complete);

    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    Intent complete = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_COMPLETE_SET);
    views.setOnClickPendingIntent(R.id.kak_widget_complete, PendingIntent.getBroadcast(context, 1101, complete, flags));

    Intent open = new Intent(context, KakWorkoutWidgetActionReceiver.class).setAction(KakWorkoutWidgetState.ACTION_OPEN);
    views.setOnClickPendingIntent(R.id.kak_widget_open, PendingIntent.getBroadcast(context, 1102, open, flags));
    views.setOnClickPendingIntent(R.id.kak_widget_root, PendingIntent.getBroadcast(context, 1103, open, flags));
    return views;
  }
}
`,
    "KakWorkoutOverlayService.java": `package ${pkg};

import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import ${packageName}.R;

public class KakWorkoutOverlayService extends Service {
  private WindowManager windowManager;
  private View overlay;
  private WindowManager.LayoutParams params;

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    KakWorkoutWidgetState state = KakWorkoutWidgetState.read(this);
    if (!state.active) {
      stopSelf();
      return START_NOT_STICKY;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
      stopSelf();
      return START_NOT_STICKY;
    }
    showOrUpdate(state);
    return START_STICKY;
  }

  private void showOrUpdate(KakWorkoutWidgetState state) {
    if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    if (overlay == null) {
      overlay = LayoutInflater.from(this).inflate(R.layout.kak_workout_overlay, null);
      int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
      params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
      );
      params.gravity = Gravity.TOP | Gravity.END;
      params.x = 24;
      params.y = 160;
      installDragHandler();
      windowManager.addView(overlay, params);
    }
    bind(state);
  }

  private void bind(KakWorkoutWidgetState state) {
    ((TextView) overlay.findViewById(R.id.kak_overlay_title)).setText(state.title());
    ((TextView) overlay.findViewById(R.id.kak_overlay_subtitle)).setText(state.subtitle());
    ((TextView) overlay.findViewById(R.id.kak_overlay_progress)).setText(state.progressLabel);
    TextView complete = overlay.findViewById(R.id.kak_overlay_complete);
    complete.setText(state.complete ? "Done" : "✓");
    complete.setEnabled(!state.complete && state.nextSetId != null && state.nextSetId.length() > 0);
    complete.setOnClickListener((view) -> KakWorkoutWidgetModule.emitCompleteSet(this, state.nextSetId));
    overlay.findViewById(R.id.kak_overlay_open).setOnClickListener((view) -> {
      Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(launch);
      }
    });
  }

  private void installDragHandler() {
    overlay.setOnTouchListener(new View.OnTouchListener() {
      private int initialX;
      private int initialY;
      private float initialTouchX;
      private float initialTouchY;
      private long downAt;

      @Override
      public boolean onTouch(View view, MotionEvent event) {
        switch (event.getAction()) {
          case MotionEvent.ACTION_DOWN:
            initialX = params.x;
            initialY = params.y;
            initialTouchX = event.getRawX();
            initialTouchY = event.getRawY();
            downAt = System.currentTimeMillis();
            return true;
          case MotionEvent.ACTION_MOVE:
            params.x = initialX - Math.round(event.getRawX() - initialTouchX);
            params.y = initialY + Math.round(event.getRawY() - initialTouchY);
            windowManager.updateViewLayout(overlay, params);
            return true;
          case MotionEvent.ACTION_UP:
            if (System.currentTimeMillis() - downAt < 180 && Math.abs(event.getRawX() - initialTouchX) < 8 && Math.abs(event.getRawY() - initialTouchY) < 8) {
              view.performClick();
            }
            return true;
        }
        return false;
      }
    });
  }

  @Override
  public void onDestroy() {
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
    android:minHeight="118dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:minResizeWidth="220dp"
    android:minResizeHeight="96dp"
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
    android:padding="14dp"
    android:background="@drawable/kak_widget_bg">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_widget_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:maxLines="1"
            android:ellipsize="end"
            android:text="Workout • 0s"
            android:textColor="#F8FAFC"
            android:textSize="16sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_widget_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:paddingLeft="10dp"
            android:paddingRight="10dp"
            android:paddingTop="5dp"
            android:paddingBottom="5dp"
            android:background="@drawable/kak_widget_progress_bg"
            android:text="0/0 sets"
            android:textColor="#60A5FA"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

    <TextView
        android:id="@+id/kak_widget_subtitle"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginTop="8dp"
        android:maxLines="2"
        android:ellipsize="end"
        android:text="Next set"
        android:textColor="#CBD5E1"
        android:textSize="13sp" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="40dp"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_widget_complete"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:gravity="center"
            android:background="@drawable/kak_widget_primary_button"
            android:text="Complete set"
            android:textColor="#FFFFFF"
            android:textSize="13sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_widget_open"
            android:layout_width="96dp"
            android:layout_height="match_parent"
            android:layout_marginLeft="10dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_secondary_button"
            android:text="Open"
            android:textColor="#F8FAFC"
            android:textSize="13sp"
            android:textStyle="bold" />
    </LinearLayout>
</LinearLayout>
`);
  write(path.join(res, "layout/kak_workout_overlay.xml"), `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="278dp"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/kak_widget_bg">
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_overlay_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:maxLines="1"
            android:ellipsize="end"
            android:textColor="#F8FAFC"
            android:textSize="14sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_overlay_progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:paddingLeft="8dp"
            android:paddingRight="8dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:background="@drawable/kak_widget_progress_bg"
            android:textColor="#60A5FA"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>
    <TextView
        android:id="@+id/kak_overlay_subtitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:maxLines="2"
        android:ellipsize="end"
        android:textColor="#CBD5E1"
        android:textSize="12sp" />
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="38dp"
        android:layout_marginTop="10dp"
        android:orientation="horizontal">
        <TextView
            android:id="@+id/kak_overlay_complete"
            android:layout_width="52dp"
            android:layout_height="match_parent"
            android:gravity="center"
            android:background="@drawable/kak_widget_primary_button"
            android:textColor="#FFFFFF"
            android:textSize="18sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/kak_overlay_open"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:layout_marginLeft="10dp"
            android:gravity="center"
            android:background="@drawable/kak_widget_secondary_button"
            android:text="Open workout"
            android:textColor="#F8FAFC"
            android:textSize="13sp"
            android:textStyle="bold" />
    </LinearLayout>
</LinearLayout>
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
}

function withWorkoutWidget(config) {
  config = withAndroidManifest(config, (mod) => {
    addWorkoutManifestEntries(mod.modResults);
    return mod;
  });

  return withDangerousMod(config, ["android", (mod) => {
    const packageName = mod.modRequest.config.android?.package;
    if (!packageName) throw new Error("Workout widget requires expo.android.package");
    writeNativeFiles(mod.modRequest.projectRoot, packageName);
    patchMainApplication(mod.modRequest.projectRoot, packageName);
    return mod;
  }]);
}

module.exports = createRunOncePlugin(withWorkoutWidget, "with-workout-widget", WIDGET_VERSION);
