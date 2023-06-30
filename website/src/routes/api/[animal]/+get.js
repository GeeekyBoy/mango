import { nanoid } from "nanoid";

export default async ({ route }) => {
  return {
    data: {
      serveTime: new Date().toISOString(),
      uid: nanoid(),
      message: `I love ${route.params.animal}!`,
    },
  };
};
