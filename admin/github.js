/* GitHub access for the site dashboard (window.GH).
   The token is sent only in the Authorization header to api.github.com; it never appears in a URL,
   in the console or in an error message. See SPEC.md. */
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

  /* Read the site files at the current head of main. */
  async function load(token, paths) {
    var list = paths || (root.DashLib && root.DashLib.FILES) || [];
    var head = await headSha(token);
    var texts = await Promise.all(list.map(function (p) {
      return call(token, "GET", "/contents/" + encPath(p) + "?ref=" + head, null, { raw: true });
    }));
    var files = {};
    list.forEach(function (p, i) { files[p] = texts[i]; });
    return { files: files, head: head };
  }

  /* One commit on main with every changed file. Rejects with code "stale" when main moved. */
  async function commit(token, files, message, expectedHead) {
    var paths = Object.keys(files || {});
    if (!paths.length) throw new GHError("other");
    var head = await headSha(token);
    if (expectedHead && head !== expectedHead) throw new GHError("stale");
    var base = await call(token, "GET", "/git/commits/" + head);
    var tree = await call(token, "POST", "/git/trees", {
      base_tree: base.tree.sha,
      tree: paths.map(function (p) { return { path: p, mode: "100644", type: "blob", content: files[p] }; })
    }, { write: true });
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

  root.GH = {
    OWNER: OWNER, REPO: REPO, BRANCH: BRANCH, PREFIX: PREFIX, UNDO_MESSAGE: UNDO_MESSAGE,
    GHError: GHError, load: load, commit: commit, lastCommit: lastCommit, undo: undo
  };
})(window);
