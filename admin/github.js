/* GitHub access for the site dashboard (window.GH).
   The token is sent only in the Authorization header to api.github.com; it never appears in a URL,
   in the console or in an error message. Every error carries a code (auth, forbidden, rate, notfound, network,
   stale, notdash, noparent, other); the interface shows its own Arabic or English text for it. See SPEC.md. */
(function (root) {
  "use strict";

  var OWNER = "DrOmaia", REPO = "DrOmaia.github.io", BRANCH = "main";
  var API = "https://api.github.com/repos/" + OWNER + "/" + REPO;
  var PREFIX = "Dashboard:";
  var UNDO_MESSAGE = "Dashboard: تراجع عن آخر نشر";

  var MSG = {
    auth: "المفتاح غير صحيح أو انتهت صلاحيته. أنشئ مفتاحًا جديدًا والصقه.",
    forbidden: "المفتاح لا يملك الصلاحية المطلوبة. تأكد أن Contents مضبوطة على Read and write للمستودع DrOmaia.github.io.",
    rate: "تجاوزت حد الطلبات المسموح من GitHub. انتظر قليلًا ثم حاول مرة أخرى.",
    notfound: "المفتاح لا يصل إلى المستودع DrOmaia.github.io. تأكد أنك اخترته في Repository access.",
    network: "تعذّر الاتصال بـ GitHub. تحقق من الإنترنت ثم حاول مرة أخرى.",
    stale: "تغيّر الموقع منذ فتحت اللوحة، فلم يُنشر شيء. أعد التحميل ثم أعد تعديلاتك.",
    notdash: "آخر تعديل على الموقع لم يكن من لوحة التحكم، فلا يمكن التراجع عنه من هنا.",
    noparent: "لا يوجد إصدار سابق للرجوع إليه.",
    other: "رفض GitHub الطلب. حاول مرة أخرى بعد قليل."
  };

  function GHError(code, status) {
    this.name = "GHError";
    this.code = code;
    this.status = status || 0;
    this.message = MSG[code] || MSG.other;
  }
  GHError.prototype = Object.create(Error.prototype);
  GHError.prototype.constructor = GHError;

  function encPath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }

  /* write=true: 403/404 mean "no write permission" rather than "not found". */
  async function call(token, method, path, body, opts) {
    opts = opts || {};
    var headers = {
      "Accept": opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (body) headers["Content-Type"] = "application/json";
    var res;
    try {
      res = await fetch(API + path, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer"
      });
    } catch (e) {
      throw new GHError("network");
    }
    if (!res.ok) {
      var code = "other";
      if (res.status === 401) code = "auth";
      else if (res.status === 403) code = res.headers.get("x-ratelimit-remaining") === "0" ? "rate" : "forbidden";
      else if (res.status === 404) code = opts.write ? "forbidden" : "notfound";
      else if (res.status === 409 || res.status === 422) code = opts.write ? "stale" : "other";
      throw new GHError(code, res.status);
    }
    if (opts.raw) return res.text();
    if (res.status === 204) return null;
    return res.json();
  }

  async function headSha(token) {
    var ref = await call(token, "GET", "/git/ref/heads/" + BRANCH);
    return ref.object.sha;
  }

  /* Files that may not exist yet in the repository: a 404 for them reads as an empty file. */
  /* Files that may not exist yet on main: a 404 for one of them is an empty string, not a failure. */
  var OPTIONAL = { "cv.html": true, "portfolio.html": true };
  ((root.DashLib && root.DashLib.OPTIONAL_FILES) || []).forEach(function (p) { OPTIONAL[p] = true; });

  /* Read the site files at the current head of main. */
  async function load(token, paths) {
    var list = paths || (root.DashLib && root.DashLib.FILES) || [];
    var head = await headSha(token);
    var texts = await Promise.all(list.map(function (p) {
      return call(token, "GET", "/contents/" + encPath(p) + "?ref=" + head, null, { raw: true }).catch(function (e) {
        if (OPTIONAL[p] && e && e.code === "notfound") return "";
        throw e;
      });
    }));
    var files = {};
    list.forEach(function (p, i) { files[p] = texts[i]; });
    return { files: files, head: head };
  }

  /* Names, sizes and paths of the files in one folder at the head of main ([] when the folder does not exist). */
  async function listDir(token, path) {
    var head = await headSha(token), got;
    try { got = await call(token, "GET", "/contents/" + encPath(path) + "?ref=" + head); }
    catch (e) { if (e && e.code === "notfound") return []; throw e; }
    if (!Array.isArray(got)) return [];
    return got.filter(function (x) { return x && x.type === "file"; }).map(function (x) {
      return { name: String(x.name), path: String(x.path), size: Number(x.size) || 0 };
    });
  }

  /* One commit on main with every changed file. Rejects with code "stale" when main moved.
     A value is either the file's text, or {base64: "..."} for a binary file (uploaded as a blob first). */
  async function commit(token, files, message, expectedHead) {
    var paths = Object.keys(files || {});
    if (!paths.length) throw new GHError("other");
    var head = await headSha(token);
    if (expectedHead && head !== expectedHead) throw new GHError("stale");
    var base = await call(token, "GET", "/git/commits/" + head);
    var entries = [];
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i], v = files[p];
      if (v && typeof v === "object" && typeof v.base64 === "string") {
        var blob = await call(token, "POST", "/git/blobs", { content: v.base64, encoding: "base64" }, { write: true });
        entries.push({ path: p, mode: "100644", type: "blob", sha: blob.sha });
      } else {
        entries.push({ path: p, mode: "100644", type: "blob", content: String(v) });
      }
    }
    var tree = await call(token, "POST", "/git/trees", { base_tree: base.tree.sha, tree: entries }, { write: true });
    var made = await call(token, "POST", "/git/commits", { message: message, tree: tree.sha, parents: [head] }, { write: true });
    await call(token, "PATCH", "/git/refs/heads/" + BRANCH, { sha: made.sha, force: false }, { write: true });
    return made.sha;
  }

  async function lastCommit(token) {
    var c = await call(token, "GET", "/commits/" + BRANCH);
    var meta = c.commit || {};
    return {
      sha: c.sha,
      message: meta.message || "",
      date: (meta.committer && meta.committer.date) || (meta.author && meta.author.date) || ""
    };
  }

  /* Restore the site to what it was before the last dashboard commit (a new commit, history is kept). */
  async function undo(token) {
    var head = await headSha(token);
    var top = await call(token, "GET", "/git/commits/" + head);
    if (String(top.message || "").indexOf(PREFIX) !== 0) throw new GHError("notdash");
    if (!top.parents || !top.parents.length) throw new GHError("noparent");
    var parent = await call(token, "GET", "/git/commits/" + top.parents[0].sha);
    var made = await call(token, "POST", "/git/commits", { message: UNDO_MESSAGE, tree: parent.tree.sha, parents: [head] }, { write: true });
    await call(token, "PATCH", "/git/refs/heads/" + BRANCH, { sha: made.sha, force: false }, { write: true });
    return made.sha;
  }

  /* ---------- approved versions: annotated git tags "stable-YYYYMMDD-HHMMSS" (message = the owner's name for it) ---------- */
  var TAG_PREFIX = "stable-", TAG_RE = /^stable-\d{8}-\d{6}(-\d+)?$/;
  var RESTORE_PREFIX = "Dashboard: restore approved version – ";

  function tagDate(tag) {
    var m = /^stable-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(tag);
    return m ? m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + "Z" : "";
  }
  /* What one tag points at: {tag, name, sha (commit), tree, date}. */
  async function resolveTag(token, tag, object) {
    var name = tag, commit = object.sha, date = tagDate(tag);
    if (object.type === "tag") {
      var tg = await call(token, "GET", "/git/tags/" + object.sha);
      name = String(tg.message || tag).trim() || tag;
      commit = tg.object.sha;
      if (tg.tagger && tg.tagger.date) date = tg.tagger.date;
    }
    var c = await call(token, "GET", "/git/commits/" + commit);
    return { tag: tag, name: name, sha: commit, tree: c.tree.sha, date: date };
  }
  /* Newest first. Also answers which tree the site has now, so the interface can mark the matching version. */
  async function listVersions(token) {
    var refs;
    try { refs = await call(token, "GET", "/git/matching-refs/tags/" + TAG_PREFIX); }
    catch (e) { if (e && e.code === "notfound") refs = []; else throw e; }
    if (!Array.isArray(refs)) refs = [];
    var found = await Promise.all(refs.map(function (r) {
      var tag = String(r.ref || "").replace(/^refs\/tags\//, "");
      if (!TAG_RE.test(tag) || !r.object) return null;
      return resolveTag(token, tag, r.object).catch(function () { return null; });
    }));
    var list = found.filter(Boolean).sort(function (a, b) { return a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0; });
    var head = await headSha(token);
    var top = await call(token, "GET", "/git/commits/" + head);
    list.head = head; list.headTree = top.tree.sha;
    return list;
  }
  async function saveVersion(token, name, sha) {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    var tag = TAG_PREFIX + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "-" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
    var label = String(name || "").replace(/\s+/g, " ").trim().slice(0, 60) || tag;
    var obj = await call(token, "POST", "/git/tags", { tag: tag, message: label, object: sha, type: "commit" }, { write: true });
    await call(token, "POST", "/git/refs", { ref: "refs/tags/" + tag, sha: obj.sha }, { write: true });
    return { tag: tag, name: label, sha: sha, date: tagDate(tag) };
  }
  /* One new commit on main whose tree is the approved version's tree; history is never rewritten. */
  async function restoreVersion(token, tag, expectedHead) {
    if (!TAG_RE.test(String(tag))) throw new GHError("other");
    var head = await headSha(token);
    if (expectedHead && head !== expectedHead) throw new GHError("stale");
    var ref = await call(token, "GET", "/git/ref/tags/" + tag);
    var v = await resolveTag(token, tag, ref.object);
    var made = await call(token, "POST", "/git/commits", { message: RESTORE_PREFIX + v.name, tree: v.tree, parents: [head] }, { write: true });
    await call(token, "PATCH", "/git/refs/heads/" + BRANCH, { sha: made.sha, force: false }, { write: true });
    return made.sha;
  }
  /* Removes the marker only; the site and its history are untouched. */
  async function deleteVersion(token, tag) {
    if (!TAG_RE.test(String(tag))) throw new GHError("other");
    await call(token, "DELETE", "/git/refs/tags/" + tag, null, { write: true });
    return true;
  }

  root.GH = {
    OWNER: OWNER, REPO: REPO, BRANCH: BRANCH, PREFIX: PREFIX, UNDO_MESSAGE: UNDO_MESSAGE,
    RESTORE_PREFIX: RESTORE_PREFIX, MAX_VERSIONS: 20,
    GHError: GHError, load: load, listDir: listDir, commit: commit, lastCommit: lastCommit, undo: undo,
    listVersions: listVersions, saveVersion: saveVersion, restoreVersion: restoreVersion, deleteVersion: deleteVersion
  };
})(window);
