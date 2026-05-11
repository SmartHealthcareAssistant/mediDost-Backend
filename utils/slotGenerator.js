const generateSlots = (date, startTime = "09:00", endTime = "17:00") => {
  const slots = [];

  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);

  while (start < end) {
    const slotStart = new Date(start);
    const slotEnd = new Date(start.getTime() + 15 * 60000);

    slots.push({ slotStart, slotEnd });

    start.setMinutes(start.getMinutes() + 15);
  }

  return slots;
};

export default generateSlots;