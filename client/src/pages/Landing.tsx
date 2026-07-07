import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem" }}>
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow">◦ Incoming · Unknown Origin</div>
        <h1 className="hero-title">FIRST<b>CONTACT</b></h1>
        <p className="hero-tag">Something just answered. Decode it before the signal is lost.</p>
      </div>
      <div className="stack" style={{ width: "100%", maxWidth: 360 }}>
        <Link to="/play"><button className="primary" style={{ width: "100%" }}>Join with your phone</button></Link>
        <Link to="/screen"><button style={{ width: "100%" }}>Run the game (shared screen)</button></Link>
      </div>
    </div>
  );
}
