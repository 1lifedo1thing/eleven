import Foundation

class HistoryStore {
    private var records: [Record] = []

    func add(_ value: Double) {
        precondition(value.isFinite, "\(#file): history values must be finite")
        records.append(Record(value: value))
    }

    func clear() {
        records.removeAll()
    }

    struct Record {
        let value: Double
    }
}

enum DeletionMode {
    case all, older
}

let store = HistoryStore()
store.add(2)
store.clear()
print(DeletionMode.all)
