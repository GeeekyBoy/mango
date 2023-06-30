import { nanoid } from "nanoid";

export let ip = "";

export default ({ userIPs }) => {
  ip = nanoid();
  return {
    data: {
      ip: userIPs[0],
    }
  };
};
