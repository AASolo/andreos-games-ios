import AVFoundation
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Музыка меню не перебивает другую музыку и молчит в беззвучном режиме
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = UIColor(named: "LaunchBg")
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
