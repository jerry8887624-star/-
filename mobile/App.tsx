import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, useColorScheme, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// 由 divination/build.py --standalone 產生的離線單一檔案
const APP_HTML = require('./assets/web/app.html');

// 在網頁載入前，把 navigator.vibrate / navigator.share 換成呼叫原生功能
const BRIDGE = `
(function () {
  function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  window.__gxNative = true;
  try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: function () { post({ type: 'haptic' }); return true; } }); } catch (e) {}
  try { Object.defineProperty(navigator, 'share', { configurable: true, value: function (d) { post({ type: 'share', title: d && d.title, text: d && d.text }); return Promise.resolve(); } }); } catch (e) {}
})();
true;
`;

type BridgeMessage = { type: 'haptic' } | { type: 'share'; title?: string; text?: string };

function onMessage(event: WebViewMessageEvent) {
  let msg: BridgeMessage;
  try {
    msg = JSON.parse(event.nativeEvent.data);
  } catch {
    return;
  }
  if (msg.type === 'haptic') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } else if (msg.type === 'share' && msg.text) {
    Share.share({ title: msg.title, message: msg.text }).catch(() => {});
  }
}

export default function App() {
  const [uri, setUri] = useState<string | null>(null);
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    Asset.fromModule(APP_HTML)
      .downloadAsync()
      .then((asset) => setUri(asset.localUri ?? asset.uri));
  }, []);

  const background = dark ? '#000000' : '#f2f2f7';

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <StatusBar style="auto" />
      {uri && (
        <WebView
          source={{ uri }}
          originWhitelist={['*']}
          allowFileAccess
          allowingReadAccessToURL={uri.slice(0, uri.lastIndexOf('/') + 1)}
          injectedJavaScriptBeforeContentLoaded={BRIDGE}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req) => {
            // App 內只顯示本機頁面，外部連結交給 Safari
            if (/^https?:/.test(req.url)) {
              Linking.openURL(req.url).catch(() => {});
              return false;
            }
            return true;
          }}
          style={{ backgroundColor: background }}
          contentInsetAdjustmentBehavior="never"
          dataDetectorTypes="none"
          allowsBackForwardNavigationGestures={false}
          allowsLinkPreview={false}
          setSupportMultipleWindows={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
