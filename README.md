# Otto

When a satellite is first turned on, it sees if it has an id.
If not, it creates an id file with a UUID.

After it has an id, it sends an init message to the cloud server.
The cloud server looks up in its db whether or not it knows that ID.
If not, it adds it without any information to it.
If so, it does nothing in particular.
But after that it sends an 'info' packet to let the sat know its settings.
(At the moment that info packet is just its timeout)
// WHEN DOES THAT GET SET

