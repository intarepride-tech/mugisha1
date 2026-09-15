import { useState } from "react";

function AgriMarket() {
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const farmerQuestions = [
    "🌾 Niyihe myaka ugurisha?",
    "Ingano y’Ibyo ufite?",
    "Ubarizwa he?",
    "Ugurisha angahe ku Kilo (1kg)?",
    "📸 Shyiraho ifoto cyangwa video y'umusaruro (niba ihari)",
    "Amazina yanyu?",
    "Numero ya WhatsApp?",
  ];

  const buyerQuestions = [
    "🛒 Izina ry'ibyo ukeneye ku bikomoka ku buhinzi ni irihe?",
    "Aho ubarizwa ni hehe?",
    "Ingano y'ibyo ukeneye ni ingahe?",
    "Amazina y’Ikigo/Business?",
    "Numero ya WhatsApp?",
  ];

  const questions =
    mode === "farmer"
      ? farmerQuestions
      : buyerQuestions;

  function start(type) {
    setMode(type);
    setStep(0);
    setAnswers({});
  }

  function goBack() {
    if (step === 0) {
      setMode(null);
      return;
    }

    setStep(step - 1);
  }

  function nextAnswer(value) {
    if (!value.trim()) return;

    setAnswers({
      ...answers,
      [step]: value,
    });

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      alert("Post ready. Backend will be connected later.");
      setMode(null);
      setStep(0);
      setAnswers({});
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f8f6",
        fontFamily: "Arial, sans-serif",
        color: "#17231d",
      }}
    >
      <header
        style={{
          background: "#087a4b",
          color: "white",
          padding: "35px 20px",
        }}
      >
        <h1 style={{ margin: 0 }}>
          🌾 Agri Market
        </h1>

        <p>
          Huza abahinzi n’abaguzi.
        </p>
      </header>

      {!mode && (
        <section
          style={{
            maxWidth: "700px",
            margin: "auto",
            padding: "25px 16px",
          }}
        >
          <button
            onClick={() => start("farmer")}
            style={buttonStyle}
          >
            🌾 Mfite/Ngurisha Imyaka
            <br />
            <small>
              Shyira umusaruro ufite kwisoko
            </small>
          </button>

          <button
            onClick={() => start("buyer")}
            style={{
              ...buttonStyle,
              background: "#1769aa",
            }}
          >
            🛒 Ngura Imyaka
            <br />
            <small>
              Shyira ibyo ukeneye kwisoko
            </small>
          </button>

          <div
            style={{
              marginTop: "30px",
              background: "white",
              padding: "25px",
              borderRadius: "20px",
            }}
          >
            <h2>Ibiri ku isoko</h2>

            <p>
              ⏳ Nta post irashyirwaho.
            </p>

            <p>
              Hitamo niba ufite imyaka
              cyangwa niba ushaka kuyigura.
            </p>
          </div>
        </section>
      )}

      {mode && (
        <section
          style={{
            maxWidth: "700px",
            margin: "auto",
            padding: "25px 16px",
          }}
        >
          <button
            onClick={goBack}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "18px",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            ← Subira inyuma
          </button>

          <p
            style={{
              color: "#087a4b",
              fontWeight: "bold",
            }}
          >
            {mode === "farmer"
              ? "🌾 Umucuruzi w’Imyaka / Umuhinzi"
              : "🛒 Ngura Imyaka"}
          </p>

          <p>
            Intambwe {step + 1} / {questions.length}
          </p>

          <div
            style={{
              background: "white",
              padding: "22px",
              borderRadius: "20px",
              marginTop: "20px",
            }}
          >
            <h2>{questions[step]}</h2>

            {step === 4 && mode === "farmer" ? (
              <>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => {
                    const file =
                      event.target.files[0];

                    if (file) {
                      nextAnswer(file.name);
                    }
                  }}
                  style={{
                    marginTop: "20px",
                  }}
                />

                <p>
                  Niba nta foto cyangwa video
                  ufite, ushobora gukomeza.
                </p>

                <button
                  onClick={() => nextAnswer("Nta media")}
                  style={buttonStyle}
                >
                  Komeza →
                </button>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  const value =
                    event.target.answer.value;

                  nextAnswer(value);
                }}
              >
                <input
                  name="answer"
                  autoFocus
                  placeholder="Andika igisubizo..."
                  style={inputStyle}
                />

                <button
                  type="submit"
                  style={buttonStyle}
                >
                  {step === questions.length - 1
                    ? "🌾 Shyira kwisoko"
                    : "Komeza →"}
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const buttonStyle = {
  width: "100%",
  padding: "18px",
  marginBottom: "15px",
  border: "none",
  borderRadius: "16px",
  background: "#087a4b",
  color: "white",
  fontSize: "17px",
  fontWeight: "bold",
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: "16px",
  marginTop: "15px",
  marginBottom: "12px",
  border: "1px solid #ccc",
  borderRadius: "12px",
  fontSize: "16px",
  boxSizing: "border-box",
};

export default AgriMarket;
