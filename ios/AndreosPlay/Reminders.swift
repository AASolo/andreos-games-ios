import Foundation
import UserNotifications

/// Вечернее напоминание в 19:00, если сегодня ещё не играли: чтобы не сгорела серия дней.
enum Reminders {
    private static let id = "andreos.streak"

    static func update(on: Bool, ask: Bool, last: String, streak: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        guard on else { return }

        let schedule = {
            let cal = Calendar.current
            let fmt = DateFormatter()
            fmt.calendar = Calendar(identifier: .gregorian)
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.dateFormat = "yyyy-MM-dd"
            let now = Date()
            let today = fmt.string(from: now)
            let yesterday = fmt.string(from: cal.date(byAdding: .day, value: -1, to: now)!)

            var day = now
            var streakAlive = last == yesterday
            if last == today {
                // сегодня уже играли — напомним завтра
                day = cal.date(byAdding: .day, value: 1, to: now)!
                streakAlive = true
            }
            var comps = cal.dateComponents([.year, .month, .day], from: day)
            comps.hour = 19
            if let fire = cal.date(from: comps), fire <= now {
                comps = cal.dateComponents([.year, .month, .day], from: cal.date(byAdding: .day, value: 1, to: now)!)
                comps.hour = 19
                streakAlive = false
            }

            let content = UNMutableNotificationContent()
            if streakAlive && streak > 0 {
                content.title = "Серия \(streak) 🔥 под угрозой"
                content.body = "Сыграй сегодня в Andreos Play, чтобы не потерять серию дней."
            } else {
                content.title = "Пора поиграть 🎮"
                content.body = "Загляни в Andreos Play: игры уже ждут."
            }
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }

        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                guard ask else { return }
                center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    if granted { schedule() }
                }
            case .authorized, .provisional, .ephemeral:
                schedule()
            default:
                break
            }
        }
    }
}
