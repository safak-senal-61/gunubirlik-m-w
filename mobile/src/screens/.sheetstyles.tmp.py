import io

path = "src/screens/ProfileScreen.tsx"
data = io.open(path, encoding="utf-8").read()

needle = "sheetSub: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 4, marginBottom: 12 },"
addition = needle + """
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2, marginBottom: 14 },
  sheetIconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIcon: { fontSize: 20 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { fontSize: 14, color: C.muted, fontWeight: "800" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
  },"""

assert needle in data, "needle not found"
assert "sheetHeader:" not in data, "already added"
data = data.replace(needle, addition, 1)
io.open(path, "w", encoding="utf-8", newline="\n").write(data)
print("styles added")
