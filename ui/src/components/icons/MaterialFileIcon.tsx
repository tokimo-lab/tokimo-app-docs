/**
 * MaterialFileIcon — renders material-design file/folder icons.
 *
 * Simplified version for standalone docs app.
 * For folders, uses the material-icon-theme SVG. For files, uses a generic icon.
 */

import { memo } from "react";

/**
 * Resolve icon SVG URL from material-icon-theme assets served at /material-icons/.
 */
function getMaterialIconUrl(
  name: string,
  isDirectory: boolean,
): { url: string; isDefault: boolean } {
  if (isDirectory) {
    // Well-known folder names get dedicated icons
    const folderMap: Record<string, string> = {
      src: "folder-src",
      ".github": "folder-github",
      node_modules: "folder-node",
      ".vscode": "folder-vscode",
      test: "folder-test",
      tests: "folder-test",
      __tests__: "folder-test",
      dist: "folder-dist",
      build: "folder-dist",
      public: "folder-public",
      assets: "folder-assets",
      images: "folder-images",
      img: "folder-images",
      components: "folder-component",
      hooks: "folder-hook",
      utils: "folder-util",
      lib: "folder-lib",
      api: "folder-api",
    };
    const lower = name.toLowerCase();
    const iconName = folderMap[lower] ?? "folder";
    return { url: `/material-icons/${iconName}.svg`, isDefault: iconName === "folder" };
  }
  return { url: `/material-icons/file.svg`, isDefault: true };
}

export const MaterialFileIcon = memo(function MaterialFileIcon({
  name,
  isDirectory = false,
  size = 14,
}: {
  name: string;
  isDirectory?: boolean;
  size?: number;
}) {
  const { url, isDefault } = getMaterialIconUrl(name, isDirectory);

  if (isDefault) {
    return (
      <span
        className="shrink-0 inline-block"
        style={{
          width: size,
          height: size,
          backgroundColor: "var(--color-accent)",
          mask: `url(${url}) center/contain no-repeat`,
          WebkitMask: `url(${url}) center/contain no-repeat`,
        }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      draggable={false}
    />
  );
});
