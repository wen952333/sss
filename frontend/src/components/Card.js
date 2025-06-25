import React from "react";
import { getCardImage } from "../utils/poker";

export default function Card({ value, suit, onClick, selected }) {
  return (
    <img
      alt={`${value} of ${suit}`}
      src={getCardImage(value, suit)}
      className={`card ${selected ? "selected" : ""}`}
      onClick={onClick}
      style={{ width: 48, height: 68, margin: 2, borderRadius: 6, border: selected ? "2px solid #6366f1" : "1px solid #ddd", background: "#fff", cursor: "pointer" }}
    />
  );
}
