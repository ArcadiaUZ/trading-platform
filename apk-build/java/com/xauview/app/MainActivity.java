package com.xauview.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String PREFS = "xauview";
    private static final String KEY_URL = "server_url";
    private static final String DEFAULT_URL = "wss://xauview.onrender.com";
    private static final String CH_ALERTS = "xauview_alerts";
    private WebView web;
    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Window w = getWindow();
        w.setStatusBarColor(Color.BLACK);
        w.setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        web.addJavascriptInterface(new Bridge(), "And");
        web.setKeepScreenOn(true);   // savdo paytida ekran o'chmasin
        createChannels();

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { public void run() { r.grant(r.getResources()); } });
            }
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) { return true; }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req != null && req.isForMainFrame()) toast("Server topilmadi - manzilni tekshiring");
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7); } catch (Throwable t) {}
        }

        // Ilova HAR DOIM APK ichidagi assets'dan yuklanadi (tez, internetsiz ham chiziladi).
        // Ma'lumot esa bulut serverdan: _m4_ui.js feedBase() default = wss://xauview.onrender.com
        load("offline");
    }

    private void load(String url) {
        if (url == null || url.trim().length() == 0 || url.trim().equalsIgnoreCase("offline")) {
            web.loadUrl("file:///android_asset/index.html");
            return;
        }
        String u = url.trim();
        if (!u.startsWith("http")) u = "http://" + u;
        if (!u.endsWith("/")) u = u + "/";
        web.loadUrl(u);
    }

    /** Manba (feed) manzilini localStorage'ga yozib, ilovani qayta yuklaydi. */
    private void applyFeed(String u) {
        final String v = u == null ? "" : u.trim();
        prefs.edit().putString(KEY_URL, v).apply();
        web.post(new Runnable() {
            public void run() {
                String js;
                if (v.length() == 0) {
                    js = "try{localStorage.removeItem('xauview.feed');}catch(e){};location.reload();";
                } else {
                    js = "try{localStorage.setItem('xauview.feed','" + v.replace("\\", "\\\\").replace("'", "\\'") + "');}catch(e){};location.reload();";
                }
                if (Build.VERSION.SDK_INT >= 19) web.evaluateJavascript(js, null);
                else web.loadUrl("javascript:" + js);
            }
        });
    }

    private void askServer(final boolean cancelable) {
        final EditText et = new EditText(this);
        et.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        et.setSingleLine(true);
        String cur = prefs.getString(KEY_URL, DEFAULT_URL);
        et.setText(cur);
        et.setSelection(et.getText().length());
        AlertDialog.Builder ab = new AlertDialog.Builder(this);
        ab.setTitle("Ma'lumot serveri");
        ab.setMessage("Standart: wss://xauview.onrender.com (bulut, 24/7).\nUy Wi-Fi: ws://192.168.1.10:8765 .\nBo'sh qoldirsangiz standart ishlatiladi.");
        ab.setView(et);
        ab.setPositiveButton("Saqlash", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface d, int i) { applyFeed(et.getText().toString()); }
        });
        ab.setNegativeButton("Standart", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface d, int i) { applyFeed(""); }
        });
        ab.show();
    }

    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_SHORT).show(); }

    public class Bridge {
        @JavascriptInterface
        public String getServer() { String s = prefs.getString(KEY_URL, ""); return s.length() == 0 ? DEFAULT_URL : s; }
        @JavascriptInterface
        public void setServer(final String u) {
            runOnUiThread(new Runnable() { public void run() { applyFeed(u); } });
        }
        @JavascriptInterface
        public void chooseServer() { runOnUiThread(new Runnable() { public void run() { askServer(true); } }); }
        @JavascriptInterface
        public void notifyAlert(final String title, final String body) { showAlertNotification(title, body); }

        @JavascriptInterface
        public String platform() { return "android-apk"; }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CH_ALERTS, "XAUView ogohlantirishlar", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Narx / zona ogohlantirishlari");
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
    }

    /** Alert oynasiga native bildirishnoma (tray). WebView fonda bo'lsa ham ko'rinadi. */
    private void showAlertNotification(final String title, final String body) {
        runOnUiThread(new Runnable() {
            public void run() {
                try {
                    Intent i = new Intent(MainActivity.this, MainActivity.class);
                    i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, i,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    Notification.Builder nb = new Notification.Builder(MainActivity.this, CH_ALERTS)
                            .setSmallIcon(android.R.drawable.ic_dialog_info)
                            .setContentTitle(title == null || title.length() == 0 ? "XAUView" : title)
                            .setContentText(body == null ? "" : body)
                            .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                            .setAutoCancel(true)
                            .setWhen(System.currentTimeMillis())
                            .setContentIntent(pi);
                    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                    nm.notify((int) (System.currentTimeMillis() % 100000), nb.build());
                } catch (Throwable t) { }
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }
}
