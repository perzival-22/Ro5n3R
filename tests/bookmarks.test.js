import test from "node:test";
import assert from "node:assert/strict";
import { collectBookmarks } from "../bookmarks.js";

test("bookmark tree keeps web links and their usable folders", () => {
  const tree = [{ id: "root", children: [
    { id: "bar", title: "Bookmarks bar", children: [
      { id: "school", title: "School", children: [
        { id: "a", title: "Course", url: "https://school.example/course" },
        { id: "bad", title: "Local file", url: "file:///private/note" }
      ] },
      { id: "b", title: "Design", url: "https://design.example/" }
    ] }
  ] }];
  const result = collectBookmarks(tree);
  assert.deepEqual(result.bookmarks.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(result.folders.map((item) => item.title), ["Bookmarks bar", "School"]);
  assert.equal(result.bookmarks[0].folderId, "school");
});
