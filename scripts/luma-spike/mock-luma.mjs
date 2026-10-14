import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_LUMA_PORT || 4010);
const EVENT_ID = "evt-spike123";
const guests = new Map([
  ["g-alice1", { name: "Alice Example", email: "alice@example.com", checkedIn: false }],
  ["g-bob22", { name: "Bob Example", email: "bob@example.com", checkedIn: true }],
  ["t9x7k2", { name: "Carol Example", email: "carol@example.com", checkedIn: false }],
]);
const sessionCookie = "luma.auth-session-key=mock-session";

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  response.end(body);
}

function page(title, content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · Mock Luma</title>
    <style>
      body{font:16px/1.5 system-ui,sans-serif;background:#f5f3ef;color:#181818;margin:0;padding:48px 20px}
      main{max-width:560px;margin:0 auto;background:white;border:1px solid #ddd9d2;border-radius:16px;padding:32px}
      h1{margin-top:0}label{display:block;margin:16px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #aaa;border-radius:8px}
      button{margin-top:24px;padding:12px 20px;border:0;border-radius:8px;background:#111;color:white;font:inherit;cursor:pointer}
      .status{padding:12px;border-radius:8px;background:#f2f0ed}.guest{display:grid;gap:12px}
    </style>
  </head>
  <body><main><p>MOCK LUMA · LOCAL TEST ONLY</p>${content}</main></body>
</html>`;
}

function renderGuest(guest, eventId, key) {
  const status = guest.checkedIn ? "Checked in" : "Not checked in";
  return page(
    "Guest check-in",
    `<h1 data-guest-name>${guest.name}</h1>
     <div class="guest">
       <div><strong>Email</strong><br><span data-guest-email>${guest.email}</span></div>
       <p class="status" data-ticket-status>${status}</p>
     </div>
     ${
       guest.checkedIn
         ? ""
         : `<form method="post" action="/check-in/${encodeURIComponent(eventId)}?pk=${encodeURIComponent(key)}"><button type="submit">Check In</button></form>`
     }`
  );
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/signin" && request.method === "GET") {
    return send(
      response,
      200,
      page(
        "Sign in",
        `<h1>Sign in to Luma</h1>
         <form method="post" action="/signin">
           <label for="email">Email</label><input id="email" name="email" type="email" required>
           <label for="password">Password</label><input id="password" name="password" type="password" required>
           <button type="submit">Sign in</button>
         </form>`
      )
    );
  }

  if (url.pathname === "/signin" && request.method === "POST") {
    request.resume();
    return send(response, 302, "", {
      location: `/check-in/${EVENT_ID}?pk=g-alice1`,
      "set-cookie": `${sessionCookie}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`,
    });
  }

  if (url.pathname === "/logout") {
    return send(response, 302, "", {
      location: "/signin",
      "set-cookie": "luma.auth-session-key=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    });
  }

  const checkInMatch = url.pathname.match(/^\/check-in\/([A-Za-z0-9-]+)$/);
  if (checkInMatch) {
    if (!request.headers.cookie?.includes(sessionCookie)) {
      return send(response, 302, "", { location: "/signin" });
    }
    const eventId = checkInMatch[1];
    const key = url.searchParams.get("pk") || "";
    const guest = eventId === EVENT_ID ? guests.get(key) : undefined;
    if (!guest) {
      return send(response, 200, page("Not Valid", "<h1>Not Valid</h1><p>This ticket could not be found.</p>"));
    }
    if (request.method === "POST") {
      request.resume();
      guest.checkedIn = true;
      return send(response, 303, "", { location: `${url.pathname}?pk=${encodeURIComponent(key)}` });
    }
    return send(response, 200, renderGuest(guest, eventId, key));
  }

  if (url.pathname === "/") {
    return send(
      response,
      200,
      page("Mock Luma", `<h1>Local mock check-in site</h1><p>Use a guest ticket QR to start.</p><a href="/signin">Sign in</a>`)
    );
  }

  return send(response, 404, page("Not found", "<h1>Not found</h1>"));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock Luma ready at http://127.0.0.1:${PORT} (event ${EVENT_ID})`);
});
