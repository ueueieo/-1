import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import { User, Room, Requests } from "./db.js";
import session from "express-session";

// const newRequest = Requests.create({
//   userId: 1,
//   roomId: 2,
//   dateStart: "2027-04-10",
//   payment: "При очном посещении",
// });

// console.log("Создание заявки:", newRequest);

// const user = User.count();
// const room = Room.count();
// const requests = Requests.count();
// console.log(user, room, requests);
//const users = db.prepare("SELECT * FROM users").all();
//const rooms = db.prepare("SELECT * FROM rooms").all();
//const requests = db.prepare("SELECT * FROM requests").all();

const RULES = [
  {
    field: "login",
    test: (v) => /^[A-Za-z0-9]{6,}$/.test(v),
    msg: "Логин: латиница+цифры, минимум 6 символов",
  },
  {
    field: "password",
    test: (v) => v && v.length >= 8,
    msg: "Пароль: минимум 8 символов",
  },
  {
    field: "fio",
    test: (v) => /^[А-Яа-яЁё\s]+$/.test(v),
    msg: "ФИО: только кириллица и пробелы",
  },
  {
    field: "phone",
    test: (v) => /^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(v),
    msg: "Телефон: формат 8(ХХХ)ХХХ-ХХ-ХХ",
  },
  {
    field: "email",
    test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    msg: "Email: некорректный формат",
  },
];

const validate = (data) =>
  RULES.filter(({ field, test }) => !test((data[field] || "").trim())).map(
    (r) => r.msg,
  );

const requireAuth = (req, res, next) =>
  req.session.userId ? next() : res.redirect("/login");

const requireAdmin = (req, res, next) =>
  req.session.login === "Conf2027" ? next() : res.redirect("/login");

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

(app.use(
  session({
    secret: "conf2027-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
),
  app.use((req, res, next) => {
    if (req.session && req.session.userId) {
      const now = Date.now();
      const INACTIVITY_LIMIT = 20 * 60 * 1000;

      if (
        req.session.lastActivity &&
        now - req.session.lastActivity > INACTIVITY_LIMIT
      ) {
        return req.session.destroy(() => {
          res.redirect("/login");
        });
      }
      req.session.lastActivity = now;
    }
    next();
  }));

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

app.get("/", (req, res) => {
  res.redirect("rooms");
});

app.get("/rooms/type/:type", (req, res) => {
  const rooms = Room.findAll().filter((r) => r.type === req.params.type);
  res.render("rooms", { rooms });
});

app.get("/register", (req, res) => {
  res.render("auth", {
    mode: "register",
    forms: {},
    errors: [],
  });
});

app.get("/rooms", (req, res) => {
  const rooms = Room.findAll();
  res.render("rooms", { rooms });
});

app.get("/dashboard", requireAuth, (req, res) => {
  const requests = Requests.findByUser(req.session.userId);
  res.render("requests_list", { isAdmin: false, requests });
});

app.get("/admin", requireAdmin, (req, res) => {
  const requests = Requests.findAllDetailed();
  res.render("requests_list", { isAdmin: true, requests });
});

app.post("/admin", requireAdmin, (req, res) => {
  Requests.updateStatus(req.body.id, req.body.status);
  res.redirect("/admin");
});

app.get("/login", (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render("auth", {
    mode: "login",
    errors: null,
    flash,
  });
});
app.post("/login", (req, res) => {
  const user = User.findByLogin(req.body.login);

  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    req.session.userId = user.id;
    req.session.fio = user.fio;
    req.session.login = user.login;
    req.session.lastActivity = Date.now();

    return res.redirect(user.login === "Conf2027" ? "/admin" : "/dashboard");
  }

  res.render("auth", {
    mode: "login",
    error: "Неверный логин или пароль",
    flash: null,
  });
});

app.all("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.post("/register", (req, res) => {
  const errors = validate(req.body);

  if (User.exists(req.body.login)) {
    errors.push("Логин уже занят");
  }
  if (errors.length) {
    return res.render("auth", {
      mode: "register",
      form: req.body,
      errors,
    });
  }
  User.create(req, body);
  req.session.flash = {
    type: "succes",
    text: "Регистрация завершена. Войдите.",
  };

  res.redirect("/login");
});

app.get("/create", (req, res) => {
  const rooms = Room.findAll();
  res.render("create_request", { rooms, errors: [] });
});

app.all("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

(app.use(
  session({
    secret: "conf2027-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
),
  app.use((req, res, next) => {
    if (req.session && req.session.userId) {
      const now = Date.now();
      const INACTIVITY_LIMIT = 20 * 60 * 1000;

      if (
        req.session.lastActivity &&
        now - req.session.lastActivity > INACTIVITY_LIMIT
      ) {
        return req.session.destroy(() => {
          res.redirect("/login");
        });
      }
      req.session.lastActivity = now;
    }
    next();
  }));

app
  .route("/create")
  .get(requireAuth, (req, res) => {
    const rooms = Room.findAll();
    res.render("create_request", { rooms, errors: [] });
  })
  .post(requireAuth, (req, res) => {
    const { room_id, date_start, payment } = req.body;
    if (!room_id || !date_start || !payment) {
      const rooms = Room.findAll();
      return res.render("create_request", {
        rooms,
        errors: ["Все поля обязательны для заполнения"],
      });
    }
    Requests.create({
      userId: req.session.userId,
      roomId: room_id,
      dateStart: date_start,
      payment: payment,
    });
    res.redirect("/dashboard");
  });

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
