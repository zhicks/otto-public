echo "This runs work computer. It should be located in otto-workcomputer-startup. Make a shortcut to this file and put it in";
echo "C:\Users\Zack\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup";
echo "Hint: just type 'startup' in an Explorer title bar.
echo "Note that this doesn't run NPM start-prod, but instead just calls node. It's a bug with npm or something."
node otto-work-computer.js;
pause;