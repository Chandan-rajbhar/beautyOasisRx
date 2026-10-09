#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>
#import <UserNotifications/UserNotifications.h>
#import <RNFBMessaging/RNFBMessagingModule.h>

@interface AppDelegate () <UNUserNotificationCenterDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Configure Firebase SDK
  [FIRApp configure];

  // Set UNUserNotificationCenterDelegate for handling notifications
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;

  self.moduleName = @"BeautyOasisRx";
  self.initialProps = [RNFBMessagingModule addCustomPropsToUserProps:nil withLaunchOptions:launchOptions];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Called when APNs successfully registered the device token
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  [FIRMessaging messaging].APNSToken = deviceToken;
}

// Called when remote notification registration failed
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  NSLog(@"[BeautyOasis] Remote notification registration failed: %@", error.localizedDescription);
}

// Handle notification presentation while app is in foreground
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  // Present alert, sound, and badge even while app is in foreground
  completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
