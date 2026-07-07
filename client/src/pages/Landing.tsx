import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem" }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="accent">SIGNAL LOCK</h1>
        <p className="dim">First contact is fading. Decode it before the signal is lost.</p>
      </div>
      <div className="stack" style={{ width: "100%", maxWidth: 360 }}>
        <Link to="/play"><button className="primary" style={{ width: "100%" }}>Join with your phone</button></Link>
        <Link to="/host"><button style={{ width: "100%" }}>Host controls</button></Link>
        <Link to="/screen"><button style={{ width: "100%" }}>Open shared screen</button></Link>
      </div>
    </div>
  );
}
