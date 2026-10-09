import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register background handler for notifications received when the app is in background or terminated
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM Background] Remote message handled in background/terminated state:', remoteMessage.messageId);
  // Perform background data processing or badge synchronization if required
  return Promise.resolve();
});

AppRegistry.registerComponent(appName, () => App);
