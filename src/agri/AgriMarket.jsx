import { useCallback, useEffect, useRef, useState } from "react";
import "./agri-market.css";
import {
  createOffer,
  parseQuantity,
  parsePrice,
  ApiError,
} from "./api";

/*
  ZAО DEAL
  Seller-only conversational intake.

  The goal is NOT to make the seller fill a form.
  The goal is to make Zao Deal feel like a market representative
  talking naturally with the seller.
*/

/* -------------------------------------------------------------------------- */
/* Crop vocabulary                                                            */
/* -------------------------------------------------------------------------- */

const CROP_TYPES = {
  ibigori: {
    name: "Ibigori",
    emoji: "🌽",
    aliases: [
      "ibigori",
      "nyirakagori",
      "kagori",
      "iburide",
    ],
  },

  ibishyimbo: {
    name: "Ibishyimbo",
    emoji: "🫘",
    aliases: [
      "ibishyimbo",
      "gurugari",
      "pasabu",
      "imvange",
    ],
  },

  amasaka: {
    name: "Amasaka",
    emoji: "🌾",
    aliases: [
      "amasaka",
    ],
  },
};

function cleanText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
}

const BEAN_VARIETIES = {
  shyushya: {
    name: "Shyushya",
    aliases: ["shyushya"],
    image: "/images/Shyushya.png",
  },
  colta: {
    name: "Colta",
    aliases: ["colta", "koluta"],
    image: "/images/colta.png",
  },
  zahabu: {
    name: "Zahabu",
    aliases: ["zahabu"],
    image: "/images/zahabu.png",
  },
  mutiki: {
    name: "Mutiki",
    aliases: ["mutiki"],
    image: "/images/Mutiki.png",
  },
};
function findBeanVariety(value) {
  const cleaned = cleanText(value);

  for (const variety of Object.values(BEAN_VARIETIES)) {
    if (variety.aliases.includes(cleaned)) {
      return variety;
    }
  }

  return null;
}

function findCrop(value) {
  const cleaned = cleanText(value);

  for (const crop of Object.values(CROP_TYPES)) {
    if (crop.aliases.includes(cleaned)) {
      return crop;
    }
  }

  return null;
}

function formatCrop(value) {
  const crop = findCrop(value);

  if (!crop) {
    return {
      name: String(value || "").trim(),
      emoji: "",
    };
  }

  return {
    name: crop.name,
    emoji: crop.emoji,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateProduct(value) {
  if (!String(value || "").trim()) {
    return "Andika izina ry'umusaruro ushaka kugurisha.";
  }

  return null;
}

function validateQuantity(value) {
  const { quantity } = parseQuantity(value);

  if (quantity === null || quantity <= 0) {
    return "Andika umubare w'ibiro, urugero: 850 kg";
  }

  return null;
}

function validatePrice(value) {
  const price = parsePrice(value);

  if (price === null || price < 0) {
    return "Andika igiciro wifuza ku kilo, urugero: 500";
  }

  return null;
}

function validateRequired(value, message) {
  if (!String(value || "").trim()) {
    return message;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Conversation                                                               */
/* -------------------------------------------------------------------------- */

const QUESTIONS = [
  {
    key: "product",
    text: "Umusaruro/Imyaka ugurisha ni uwuhe? 🌾",
    placeholder: "Urugero: Ibigori",
    validate: validateProduct,
  },

  {
    key: "variety",
    text: "Ok, ibishyimbo ufite ni bihe: Shyushya, Colta, Zahabu cg Mutiki? 🫘",
    placeholder: "Urugero: Mutiki",
    validate: (value) => {
      const variety = findBeanVariety(value);

      if (!variety) {
        return "Hitamo ubwoko bumwe: Shyushya, Colta, Zahabu cg Mutiki.";
      }

      return null;
    },
  },

  {
    key: "quantity",
    text: "Ufite ibiro bingahe?",
    placeholder: "Urugero: 850 kg",
    validate: validateQuantity,
  },

  {
    key: "pricePerKg",
    text: "Ni ikihe giciro wifuza ku kilo kimwe?",
    placeholder: "Urugero: 500",
    validate: validatePrice,
  },

  {
    key: "location",
    text: "Umusaruro uri he? 📍",
    placeholder: "Urugero: Ruhuha",
    validate: (value) =>
      validateRequired(value, "Andika aho umusaruro uherereye."),
  },

  {
    key: "name",
    text: "Andika amazina yawe yose.",
    placeholder: "Amazina yawe",
    validate: (value) =>
      validateRequired(value, "Andika amazina yawe yose."),
  },

  {
    key: "whatsapp",
    text: "Numero ya telefone wakoresha tuvugana ni iyihe? 📱",
    placeholder: "07XX XXX XXX",
    validate: (value) =>
      validateRequired(value, "Andika numero ya telefone yawe."),
  },
];

/* -------------------------------------------------------------------------- */
/* Message IDs                                                                */
/* -------------------------------------------------------------------------- */

let messageId = 0;

function nextMessageId() {
  messageId += 1;
  return messageId;
}

/* -------------------------------------------------------------------------- */
/* Notification sound                                                         */
/* -------------------------------------------------------------------------- */

function playBotSound() {
  try {
    const audio = new Audio(
      new URL("./sounds/message-notification.mpeg", import.meta.url)
    );

    audio.volume = 0.45;
    audio.currentTime = 0;

    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch(() => {
        // Sound is optional. Never let audio stop the conversation.
      });
    }
  } catch {
    // Sound is optional. Never let audio stop the conversation.
  }
}


function ZaoDealLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Zao Deal"
      role="img"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M20 34C20 27 20 22 20 17"
        stroke="#18864B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 20C12 20 7 16 7 9C14 9 20 12 20 20Z"
        fill="#7BCB32"
      />
      <path
        d="M20 18C20 10 26 5 34 6C34 14 29 19 20 18Z"
        fill="#18864B"
      />
      <path
        d="M15 34H25"
        stroke="#F4B400"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* UI components                                                              */
/* -------------------------------------------------------------------------- */

function TypingRow() {
  return (
    <div className="am-bubble-row assistant">
      <span className="am-avatar"><ZaoDealLogo size={26} /></span>

      <div className="am-bubble assistant">
        <span className="am-typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

function MessageRow({ msg }) {
  const isUser = msg.from === "user";

  return (
    <div className={`am-bubble-row ${isUser ? "user" : "assistant"}`}>
      {!isUser && <span className="am-avatar"><ZaoDealLogo size={26} /></span>}

      <div className={`am-bubble ${isUser ? "user" : "assistant"}`}>
        {msg.text}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Seller chat                                                                */
/* -------------------------------------------------------------------------- */

function ZaoDealChat({ onExit }) {
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [inputValue, setInputValue] = useState("");
  const [typing, setTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);

  const endRef = useRef(null);
  const startedRef = useRef(false);
  const timersRef = useRef([]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, []);

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timersRef.current.push(timer);
    });
  }

  const pushUser = useCallback(
    (text) => {
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          from: "user",
          text,
        },
      ]);

      scrollToEnd();
    },
    [scrollToEnd]
  );

  const pushBot = useCallback(
    async (text, delay = 750) => {
      setTyping(true);
      scrollToEnd();

      await wait(delay);

      setTyping(false);

      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          from: "assistant",
          text,
        },
      ]);

      playBotSound();
      scrollToEnd();
    },
    [scrollToEnd]
  );

  /* ---------------------------------------------------------------------- */
  /* Start conversation                                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (startedRef.current) return;

    startedRef.current = true;

    async function start() {
      await pushBot("Muraho 👋", 350);

      await pushBot(
        "Ndi Zao Deal. Tugura imyaka. Turimo gushaka abacuruzi bafite imyaka bagurisha.",
        650
      );

      await pushBot(QUESTIONS[0].text, 650);
    }

    start();

   return () => {
  timersRef.current.forEach(clearTimeout);
  timersRef.current = [];
  startedRef.current = false;
};
  }, [pushBot]);

  useEffect(() => {
    scrollToEnd();
  }, [messages, typing, scrollToEnd]);

  /* ---------------------------------------------------------------------- */
  /* Send final offer to backend                                             */
  /* ---------------------------------------------------------------------- */

  async function submitOffer(finalAnswers) {
    setSubmitting(true);
    setError(null);

    try {
      await pushBot(
        "Murakoze. Reka twohereze amakuru yanyu kuri Zao Deal...",
        700
      );

      await createOffer(finalAnswers);

      setCompleted(true);

      await pushBot(
        "🎉 Murakoze! Amakuru yawe yakiriwe.",
        600
      );

      await pushBot(
        "🏪 Zao Deal irakuvugisha vuba.",
        650
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Habaye ikibazo mu kohereza amakuru. Ongera ugerageze.";

      setError(message);

      await pushBot(
        "😕 Habaye ikibazo mu kohereza amakuru. Ongera ugerageze.",
        450
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Move conversation to next question                                      */
  /* ---------------------------------------------------------------------- */

  async function advance(rawValue) {
    const question = QUESTIONS[step];

    const problem = question.validate
      ? question.validate(rawValue)
      : null;

    if (problem) {
      await pushBot(problem, 350);
      return;
    }

    let value = rawValue.trim();

    /* Normalize known crop names. */

    if (question.key === "product") {
      const crop = formatCrop(value);

      value = crop.name;

      const cropMessage = crop.emoji
        ? `Ni byiza! ${crop.emoji} ${crop.name}.`
        : `Ni byiza! ${crop.name}.`;

      pushUser(rawValue);

      setInputValue("");

      const nextAnswers = {
        ...answers,
        product: value,
      };

      setAnswers(nextAnswers);

      await pushBot(cropMessage, 500);

      const nextStep = step + 1;

      setStep(nextStep);

      if (crop.name === "Ibishyimbo") {
        await pushBot(QUESTIONS[nextStep].text, 650);
      } else {
        const quantityStep = nextStep + 1;
        setStep(quantityStep);
        await pushBot(QUESTIONS[quantityStep].text, 650);
      }

      return;
    }

    pushUser(rawValue);
    setInputValue("");

    const nextAnswers = {
      ...answers,
      [question.key]: value,
    };

    setAnswers(nextAnswers);

    /* Bean variety response */

    if (question.key === "variety") {
      const variety = findBeanVariety(value);

      if (!variety) {
        await pushBot(
          "Hitamo ubwoko bumwe: Shyushya, Colta, Zahabu cg Mutiki.",
          350
        );
        return;
      }

      const nextAnswersWithVariety = {
        ...nextAnswers,
        product: "Ibishyimbo",
        variety: variety.name,
        media: variety.image,
        mediaType: "image/jpeg",
      };

      setAnswers(nextAnswersWithVariety);

      await pushBot(
        `Ni byiza! 🫘 Ibishyimbo bya ${variety.name}.`,
        500
      );

      const quantityStep = step + 1;
      setStep(quantityStep);

      await pushBot(QUESTIONS[quantityStep].text, 650);
      return;
    }

    /* Quantity response */

    if (question.key === "quantity") {
      const crop = formatCrop(answers.product);

      const quantity = parseQuantity(value);

      const cropLabel = crop.emoji
        ? `${crop.emoji} ${crop.name}`
        : crop.name;

      await pushBot(
        `${quantity.quantity} ${quantity.unit} ${cropLabel}, ndabyakiriye. 👍`,
        500
      );

      const nextStep = step + 1;

      setStep(nextStep);

      await pushBot(QUESTIONS[nextStep].text, 650);

      return;
    }

    /* Price response */

    if (question.key === "pricePerKg") {
      const price = parsePrice(value);

      await pushBot(
        `${price} Fr/kg, ndabyumva 👍`,
        500
      );

      await pushBot(
        "Icyitonderwa: iki ni igiciro usaba. Igiciro cya nyuma kizumvikanwaho hagati yawe n'isoko. 🤝",
        700
      );

      const nextStep = step + 1;

      setStep(nextStep);

      await pushBot(QUESTIONS[nextStep].text, 650);

      return;
    }

    /* Location response */

    if (question.key === "location") {
      await pushBot(
        `${value}, byumvikanye. 👍`,
        500
      );

      const nextStep = step + 1;

      setStep(nextStep);

      await pushBot(QUESTIONS[nextStep].text, 650);

      return;
    }

    /* Name response */

    if (question.key === "name") {
      const firstName = value.split(/\s+/)[0];

      await pushBot(
        `Murakoze ${firstName}! 😊`,
        500
      );

      const nextStep = step + 1;

      setStep(nextStep);

      await pushBot(QUESTIONS[nextStep].text, 650);

      return;
    }

    /* Phone response = final step */

    if (question.key === "whatsapp") {
      await submitOffer(nextAnswers);
    }
  }

  function onSubmit(event) {
    event.preventDefault();

    const value = inputValue.trim();

    if (!value || submitting || completed || typing) return;

    advance(value);
  }

  function confirmExit() {
    if (
      messages.length > 1 &&
      !completed &&
      !window.confirm(
        "Urashaka kuva mu kiganiro cya Zao Deal?"
      )
    ) {
      return;
    }

    onExit();
  }

  const currentQuestion = QUESTIONS[step];

  /* ---------------------------------------------------------------------- */
  /* Completed confirmation                                                  */
  /* ---------------------------------------------------------------------- */

  if (completed) {
    const crop = formatCrop(answers.product);
    const quantity = parseQuantity(answers.quantity);
    const price = parsePrice(answers.pricePerKg);

    return (
      <div className="am-root">
        <div className="am-shell">
          <div className="am-chat">
            <div className="am-chat-header">
              <button
                className="am-back-btn"
                onClick={onExit}
                aria-label="Subira inyuma"
              >
                ←
              </button>

              <div>
                <p
                  className="am-chat-title"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    color: "#18864B",
                  }}
                >
                  <ZaoDealLogo size={25} />
                  <span>Zao Deal</span>
                </p>

                <p className="am-chat-progress">
                  Tugura Imyaka
                </p>
              </div>
            </div>

            <div className="am-messages">
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  msg={message}
                />
              ))}

              {typing && <TypingRow />}

              <div ref={endRef} />
            </div>

            <div className="am-summary-wrap">
              <div className="am-summary-card">
                <div className="am-summary-body">
                  <p className="am-summary-title">
                    🎉 Amakuru yawe yakiriwe
                  </p>

                  <div className="am-summary-grid">
                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Imyaka
                      </span>

                      <span className="am-summary-value">
                        {crop.emoji} {crop.name}
                        {answers.variety ? ` — ${answers.variety}` : ""}
                      </span>
                    </div>

                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Ingano
                      </span>

                      <span className="am-summary-value">
                        {quantity.quantity} {quantity.unit}
                      </span>
                    </div>

                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Igiciro usaba
                      </span>

                      <span className="am-summary-value">
                        {price} Fr/kg
                      </span>
                    </div>

                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Aho biherereye
                      </span>

                      <span className="am-summary-value">
                        {answers.location}
                      </span>
                    </div>

                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Amazina
                      </span>

                      <span className="am-summary-value">
                        {answers.name}
                      </span>
                    </div>

                    <div className="am-summary-item">
                      <span className="am-summary-label">
                        Telefoni
                      </span>

                      <span className="am-summary-value">
                        {answers.whatsapp}
                      </span>
                    </div>
                  </div>

                  <p
                    className="am-post-line"
                    style={{
                      marginTop: 18,
                      textAlign: "center",
                    }}
                  >
                    Igiciro gishobora kuganirwaho. 🤝
                  </p>

                  <p
                    className="am-post-line"
                    style={{
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    🏪 Zao Deal irakuvugisha vuba.
                  </p>

                  <div
                    style={{
                      marginTop: 18,
                      textAlign: "center",
                    }}
                  >
                    <button
                      className="am-deal-btn"
                      onClick={onExit}
                    >
                      Tangira ikindi kiganiro
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="am-error-banner">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Main chat                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="am-root">
      <div className="am-shell">
        <div className="am-chat">
          <div className="am-chat-header">
            <button
              className="am-back-btn"
              onClick={confirmExit}
              aria-label="Subira inyuma"
            >
              ←
            </button>

            <div>
              <p
                className="am-chat-title"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  color: "#18864B",
                }}
              >
                <ZaoDealLogo size={25} />
                <span>Zao Deal</span>
              </p>

              <p className="am-chat-progress">
                Tugura Imyaka
              </p>
            </div>
          </div>

          <div className="am-messages">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                msg={message}
              />
            ))}

            {typing && <TypingRow />}

            <div ref={endRef} />
          </div>

          {error && (
            <div className="am-error-banner">
              {error}
            </div>
          )}

          <form
            className="am-input-bar"
            onSubmit={onSubmit}
          >
            <input
              type="text"
              autoFocus
              placeholder={
                currentQuestion?.placeholder ||
                "Andika igisubizo..."
              }
              value={inputValue}
              onChange={(event) =>
                setInputValue(event.target.value)
              }
              disabled={
                submitting ||
                completed ||
                typing
              }
            />

            <button
              type="submit"
              className="am-send-btn"
              disabled={
                submitting ||
                completed ||
                typing ||
                !inputValue.trim()
              }
              aria-label="Ohereza"
            >
              {submitting ? "…" : "➤"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* App entry                                                                  */
/* -------------------------------------------------------------------------- */

export default function AgriMarket() {
  return (
    <ZaoDealChat
      onExit={() => {
        window.location.reload();
      }}
    />
  );
}