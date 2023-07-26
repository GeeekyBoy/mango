export let ip = "";

export default async ({ userIPs }) => {
  return {
    data: {
      ip: userIPs[0],
    }
  };
};
