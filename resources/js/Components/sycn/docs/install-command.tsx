"use client"

import { useState, useEffect } from "react"
import { CopyButton } from "./copy-button"

const managers = ["npm", "pnpm", "bun"] as const

const commands = (comp: string) => ({
  npm: `npx sycn add ${comp}`,
  pnpm: `pnpm dlx sycn add ${comp}`,
  bun: `bunx sycn add ${comp}`,
})

export function InstallCommand({ name, command }: { name?: string; command?: string }) {
  const [active, setActive] = useState<(typeof managers)[number]>("npm")
  const comp = name || command?.split(" ").pop() || ""
  const cmd = commands(comp)[active]

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex border-b">
        {managers.map((pm) => (
          <button
            key={pm}
            onClick={() => setActive(pm)}
            className={`px-4 py-2 text-sm font-medium ${
              active === pm ? "border-b-2 border-primary" : ""
            }`}
          >
            {pm}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="bg-[#1e1e1e] text-[#d4d4d4] overflow-x-auto p-4 text-sm font-mono">
          <code>{cmd}</code>
        </pre>
        <CopyButton text={cmd} />
      </div>
    </div>
  )
}
