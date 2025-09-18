export interface GGUFFile {
  name: string;
  size: number;
  modified: string;
  arch:string;
  params:string;
  quant:string;
}

export type ModelState = {
  folder: string;
  files: GGUFFile[];
  selected?: GGUFFile | null;
  hasLoaded:boolean
};

