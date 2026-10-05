"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Avatar as DiceBearAvatar, Style } from "@dicebear/core";
import dylanDefinition from "@dicebear/styles/dylan.json";
import loreleiDefinition from "@dicebear/styles/lorelei.json";
import notionistsDefinition from "@dicebear/styles/notionists.json";
import shapesDefinition from "@dicebear/styles/shapes.json";
import sliceDefinition from "@dicebear/styles/slice.json";
import squirclesDefinition from "@dicebear/styles/squircles.json";
import wavesDefinition from "@dicebear/styles/waves.json";

type AvatarRole = "professor" | "student";

const professorStyles = [
  new Style(squirclesDefinition),
  new Style(sliceDefinition),
  new Style(shapesDefinition),
  new Style(wavesDefinition),
];

const studentStyles = [
  { style: new Style(loreleiDefinition), hasColoredBackground: true },
  { style: new Style(notionistsDefinition), hasColoredBackground: true },
  { style: new Style(dylanDefinition), hasColoredBackground: false },
];

const studentBackgrounds = [
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#fef3c7",
  "#e0e7ff",
  "#cffafe",
  "#ffedd5",
  "#f3e8ff",
];

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

interface RoleAvatarProps {
  role: AvatarRole;
  name: string;
  identifier?: string | number | null;
  className?: string;
  fallbackClassName?: string;
}

export function RoleAvatar({
  role,
  name,
  identifier,
  className,
  fallbackClassName,
}: RoleAvatarProps) {
  const rawIdentity = String(identifier || name || "user").trim();
  const identity = rawIdentity.includes("@") ? rawIdentity.toLowerCase() : rawIdentity;
  const avatar = useMemo(() => {
    const seedHash = hashSeed(`${role}:${identity}`);
    const styleIndex = seedHash % (role === "professor" ? professorStyles.length : studentStyles.length);
    const style = role === "professor"
      ? professorStyles[styleIndex]
      : studentStyles[styleIndex].style;
    const backgroundColor = role === "student" && studentStyles[styleIndex].hasColoredBackground
      ? studentBackgrounds[hashSeed(`${identity}:background`) % studentBackgrounds.length]
      : undefined;

    return {
      src: new DiceBearAvatar(style, { seed: identity }).toDataUri(),
      backgroundColor,
    };
  }, [identity, role]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <Avatar className={className} style={{ backgroundColor: avatar.backgroundColor }}>
      <AvatarImage src={avatar.src} alt="" />
      <AvatarFallback className={fallbackClassName}>{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
